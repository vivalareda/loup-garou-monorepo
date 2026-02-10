import type { DeathCause, Segment, SegmentType } from '@repo/types';
import { Context, Deferred, Duration, Effect, Layer, Match, Ref } from 'effect';
import type { Player } from '@/core/player.js';
import { AudioManager } from './AudioManager.js';
import { DayVote } from './DayVote.js';
import { DeathManager } from './DeathManager.js';
import {
  NotEnoughPlayersError,
  SegmentNotFoundError,
  SheriffPlayerNotFoundError,
  SheriffPlayerNotSetError,
} from './errors.js';
import { Game } from './Game.js';
import { Lobby } from './Lobby.js';
import { MockScenario } from './MockScenario.js';
import { SocketServer } from './SocketServer.js';
import { checkIfWinner } from './win-conditions.js';

const makeGameFlow = Effect.gen(function* () {
  const game = yield* Game;
  const lobby = yield* Lobby;
  const io = yield* SocketServer;
  const audio = yield* AudioManager;
  const mockScenarios = yield* MockScenario;
  const deathManager = yield* DeathManager;

  type Scenario = (typeof mockScenarios)[keyof typeof mockScenarios];

  let currentSegmentIndex = 0;

  let cupidDeferred: Deferred.Deferred<{
    lover1: string;
    lover2: string;
  }> | null = null;

  let loverDefer: Deferred.Deferred<void> | null = null;

  let witchHealDeferred: Deferred.Deferred<boolean> | null = null;
  let witchPoisonDeferred: Deferred.Deferred<string | null> | null = null;
  let werewolfVoteDeferred: Deferred.Deferred<string> | null = null;
  let dayVoteDeferred: Deferred.Deferred<{
    target: string;
    isSheriffVote: boolean;
  }> | null = null;
  let dayVoteTieDeferred: Deferred.Deferred<string> | null = null;
  let hunterDeferred: Deferred.Deferred<string> | null = null;
  const gameEndedAndAnnounced = yield* Ref.make(false);

  const applyMockLovers = Effect.fn('applyMockLovers')(function* (
    mockScenario: Scenario,
    sortedPlayers: Player[]
  ) {
    if (!mockScenario.loversIndex) {
      yield* Effect.log('no mock lovers');
      return;
    }

    const first = sortedPlayers[mockScenario.loversIndex[0]];
    const second = sortedPlayers[mockScenario.loversIndex[1]];
    if (first && second) {
      yield* game.setLovers(first.getSocketId(), second.getSocketId());
    }
  });

  const applyWerewolvesTarget = Effect.fn('applyWerewolvesTarget')(function* (
    mockScenario: Scenario,
    sortedPlayers: Player[]
  ) {
    if (mockScenario.werewolvesTargetIndex === undefined) {
      return;
    }

    const victim = sortedPlayers[mockScenario.werewolvesTargetIndex];
    if (victim) {
      yield* deathManager.addToPendingDeath('WEREWOLVES', victim.getSocketId());
      yield* Effect.log(yield* deathManager.getVictim('WEREWOLVES'));
      yield* deathManager.log;
    }
  });

  const applyPendingDeaths = Effect.fn('applyPendingDeaths')(function* (
    mockScenario: Scenario,
    sortedPlayers: Player[]
  ) {
    if (!mockScenario.pendingDeaths) {
      return;
    }

    yield* Effect.forEach(mockScenario.pendingDeaths, (death) =>
      Effect.gen(function* () {
        const player = sortedPlayers[death.slot];
        if (player) {
          yield* deathManager.addToPendingDeath(
            death.cause,
            player.getSocketId()
          );
        }
      })
    );
  });

  const emitRoleAssignments = Effect.fn('emitRoleAssignments')(
    (players: Player[]) =>
      Effect.sync(() => {
        for (const player of players) {
          io.to(player.socketId).emit('player:role-assigned', player.role);
        }
      })
  );

  const applyKillWerewolves = Effect.fn('applyKillWerewolves')(function* (
    mockScenario: Scenario
  ) {
    if (!mockScenario.killWerewolves) {
      return;
    }

    const werewolves = yield* game.getWerewolves;
    yield* Effect.log(`Found ${werewolves.length} werewolves to kill`);
    yield* Effect.forEach(werewolves, (wolf, index) =>
      Effect.gen(function* () {
        const cause = index === 0 ? 'WITCH_POISON' : 'WEREWOLVES';
        yield* Effect.log(
          `Killing werewolf ${wolf.getName()} with cause ${cause}`
        );
        yield* deathManager.addToPendingDeath(cause, wolf.getSocketId());
      })
    );
  });

  const segments: Segment[] = [
    { type: 'CUPID', skip: false },
    { type: 'LOVERS', skip: false },
    { type: 'WEREWOLF', skip: false },
    { type: 'WITCH', skip: false },
    { type: 'DAY_VOTE', skip: false },
  ];

  const startGame = Effect.gen(function* () {
    yield* game.startGame;

    const players = yield* game.getPlayers;

    for (const player of players) {
      yield* Effect.log(`role ${player.role} assigned to ${player.name}`);
      io.to(player.socketId).emit('player:role-assigned', player.role);
    }

    const sheriffPlayer = yield* game.getSheriffPlayer;

    if (!sheriffPlayer) {
      return yield* new SheriffPlayerNotSetError();
    }

    io.to(sheriffPlayer).emit('alert:player-is-sheriff');

    yield* lobby.clear;
    yield* audio.playIntro;
    yield* playAllSegments;
  });

  const playAllSegments = Effect.gen(function* () {
    let gameEnded = false;
    const startIndex = currentSegmentIndex;

    yield* Effect.loop(startIndex, {
      while: (i) =>
        !gameEnded && findNextSegment(segments, i) < segments.length,
      step: () => currentSegmentIndex + 1,
      body: Effect.fn('body')(function* (i) {
        const nextIdx = findNextSegment(segments, i);
        currentSegmentIndex = nextIdx;
        const segmentType = segments[nextIdx].type;
        yield* Effect.log(
          `>>> DISPATCHING SEGMENT: ${segmentType} (index: ${nextIdx}) <<<`
        );
        yield* dispatchSegmentAction(segmentType);

        const segmentEndedGame = yield* checkWinCondition;
        if (segmentEndedGame) {
          yield* Effect.log('Game ended - stopping segment loop');
          gameEnded = true;
        }
      }),
    });
  });

  const loadMockScenario = Effect.fn('loadMockScenario')(function* (
    scenario: SegmentType
  ) {
    const mockScenario = mockScenarios[scenario as keyof typeof mockScenarios];
    if (!mockScenario) {
      return yield* new SegmentNotFoundError({ segment: scenario });
    }
    yield* Effect.log(`playing mock scenario ${mockScenario.segment}`);
    const lobbyPlayers = yield* lobby.getAllPlayers;
    if (mockScenario.players.length !== lobbyPlayers.length) {
      console.log('not enough players');
      return yield* Effect.fail(yield* new NotEnoughPlayersError());
    }

    yield* game.setPlayers(mockScenario);
    const players = yield* game.getPlayers;
    const sortedPlayers = players.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });

    yield* Effect.log(`players is: ${players}`);

    yield* applyMockLovers(mockScenario, sortedPlayers);
    yield* applyWerewolvesTarget(mockScenario, sortedPlayers);
    yield* applyPendingDeaths(mockScenario, sortedPlayers);
    yield* emitRoleAssignments(players);
    yield* applyKillWerewolves(mockScenario);

    currentSegmentIndex = mockScenario.index;
    yield* playAllSegments;
  });

  const markSegmentAsSkipped = Effect.fn('markSegmentAsSkipped')(function* (
    segment: SegmentType
  ) {
    const targetSegment = segments.find((s) => s.type === segment);

    if (!targetSegment) {
      return yield* new SegmentNotFoundError({ segment });
    }

    targetSegment.skip = true;
    return targetSegment;
  });

  const dispatchSegmentAction = Effect.fn('dispatchSegmentAction')(function* (
    segment: SegmentType
  ) {
    const effect = Match.value(segment).pipe(
      Match.when('CUPID', () => runCupidSegment),
      Match.when('LOVERS', () => runLoverSegment),
      Match.when('WEREWOLF', () => runWerewolfSegment),
      Match.when('WITCH', () => runWitchSegment),
      Match.when('DAY_VOTE', () => runDayVoteSegment),
      Match.orElse((s) => Effect.fail(new SegmentNotFoundError({ segment: s })))
    );
    yield* effect;
  });

  const setCurrentSegment = (segmentIndex: number) =>
    Effect.sync(() => {
      currentSegmentIndex = segmentIndex;
    });

  const getCurrentSegment = Effect.sync(() => segments[currentSegmentIndex]);

  type HunterDeath = { sid: string; cause: DeathCause };

  const getPendingHunterDeathFromMap = (
    pendingDeaths: Map<DeathCause, Player>
  ): HunterDeath | null => {
    for (const [cause, player] of pendingDeaths.entries()) {
      if (player.getRole() === 'HUNTER') {
        return { sid: player.getSocketId(), cause };
      }
    }
    return null;
  };

  const playHunterIntroAudio = Effect.fn('playHunterIntroAudio')(function* (
    hunterDeath: HunterDeath
  ) {
    const hunterIsLover = yield* game.isPlayerLover(hunterDeath.sid);
    if (!hunterIsLover) {
      return;
    }

    if (hunterDeath.cause === 'PARTNER_SUICIDE') {
      yield* audio.playAudio('Special-death/hunter-is-lover');
      return;
    }

    yield* audio.playAudio('Special-death/pre-day-vote-lover-2');
  });

  const handleHunterRevenge = Effect.fn('handleHunterRevenge')(function* (
    hunterDeath: HunterDeath,
    playIntro: boolean
  ) {
    if (playIntro) {
      yield* playHunterIntroAudio(hunterDeath);
    }

    const victimSid = yield* runHunterRevenge(hunterDeath.sid);
    const victimIsLover = yield* game.isPlayerLover(victimSid);
    if (victimIsLover) {
      yield* audio.playAudio('Special-death/hunter-killed-lover');
    }
    yield* deathManager.addToPendingDeath('HUNTER_REVENGE', victimSid);
  });

  const playDeathAnnouncement = Effect.fn('playDeathAnnouncement')(function* (
    deathCount: number,
    pendingPlayers: Player[],
    hunterDeath: HunterDeath | null
  ) {
    if (hunterDeath?.cause === 'PARTNER_SUICIDE') {
      yield* audio.playAudio('Night-end/Wake-up-everyone');
      yield* audio.playAudio('Special-death/hunter-is-lover');
      return;
    }

    const loverFlags = yield* Effect.forEach(pendingPlayers, (player) =>
      game.isPlayerLover(player.getSocketId())
    );
    const hasLoverDeath = loverFlags.some(Boolean);

    if (hasLoverDeath) {
      yield* audio.playAudio('Special-death/pre-day-vote-lover-2');
      return;
    }

    yield* audio.playDeathAnnoucementAudio(deathCount);
  });

  const resolvePendingDeathsBeforeDayVote = Effect.fn(
    'resolvePendingDeathsBeforeDayVote'
  )(function* (hunterDeath: HunterDeath | null) {
    if (hunterDeath) {
      yield* handleHunterRevenge(hunterDeath, false);
    }

    yield* confirmAndAlertPlayerOfDeath();

    const playersAfterDeaths = yield* game.getPlayers;
    yield* Effect.log('=== DEBUG: Players after death processing ===');
    yield* Effect.forEach(playersAfterDeaths, (p) =>
      Effect.log(`  ${p.getName()}: role=${p.getRole()}, alive=${p.isAlive}`)
    );
    yield* deathManager.log;

    return yield* checkWinCondition;
  });

  const playDayVoteStartAudio = Effect.fn('playDayVoteStartAudio')(function* (
    hunterSid: string | null
  ) {
    if (hunterSid) {
      yield* audio.playAudio('Hunter/Hunter-start-vote');
      return;
    }

    yield* audio.playAudio('day-vote-start-universal');
  });

  const runDayVoteSegment = Effect.gen(function* () {
    const winner = yield* checkWinCondition;

    if (winner) {
      yield* Effect.log('the game is done');
      return;
    }

    const deathCount = yield* deathManager.deathCount;
    const pendingDeaths = yield* deathManager.getPendingDeath;
    const pendingPlayers = Array.from(pendingDeaths.values());
    const hunterDeath = getPendingHunterDeathFromMap(pendingDeaths);

    yield* playDeathAnnouncement(deathCount, pendingPlayers, hunterDeath);

    const winnerAfterDeaths =
      yield* resolvePendingDeathsBeforeDayVote(hunterDeath);
    yield* Effect.log(
      `=== DEBUG: Winner check after deaths: ${winnerAfterDeaths} ===`
    );
    if (winnerAfterDeaths) {
      yield* Effect.log('Game ended - all werewolves eliminated');
      return;
    }

    yield* playDayVoteStartAudio(hunterDeath?.sid ?? null);

    dayVoteDeferred = yield* Deferred.make<{
      target: string;
      isSheriffVote: boolean;
    }>();

    yield* promptVillage;
    const votedPlayer = yield* Deferred.await(dayVoteDeferred);
    yield* confirmAndAlertSingleDeath(
      votedPlayer.target,
      'DAY_VOTE',
      votedPlayer.isSheriffVote
    );
    const gameEnded = yield* checkWinCondition;
    if (gameEnded) {
      yield* Effect.log('Game ended after day vote - werewolves eliminated');
      return;
    }

    yield* Effect.log(
      '>>> DAY_VOTE SEGMENT COMPLETED - proceeding to next segment <<<'
    );
  });

  const confirmAndAlertPlayerOfDeath = Effect.fn('alertOfDeath')(function* () {
    const pendingDeaths = yield* deathManager.getPendingDeath;
    const deaths = Array.from(pendingDeaths.entries());

    yield* Effect.forEach(deaths, ([cause, player]) =>
      Effect.gen(function* () {
        const playerSid = player.getSocketId();
        player.kill();
        yield* game.playerIsDead(playerSid);
        io.to(playerSid).emit('alert:player-is-dead');
        yield* Effect.log(`Player ${player.getName()} died: ${cause}`);
      })
    );

    yield* deathManager.clear;
  });

  const finalizeDeathsAfterHunter = Effect.fn('finalizeDeathsAfterHunter')(
    function* () {
      yield* confirmAndAlertPlayerOfDeath();
      const ended = yield* checkWinCondition;
      return ended;
    }
  );

  // biome-ignore lint: day vote audio flow is branching
  const handleDayVoteDeath = Effect.fn('handleDayVoteDeath')(function* (
    playerSid: string,
    isHunter: boolean
  ) {
    const isLover = yield* game.isPlayerLover(playerSid);
    yield* audio.playAudio('Day-vote/Vote-Death');
    yield* deathManager.addToPendingDeath('DAY_VOTE', playerSid);
    const pendingDeaths = yield* deathManager.getPendingDeath;
    const pendingHunterDeath: HunterDeath | null = isHunter
      ? { sid: playerSid, cause: 'DAY_VOTE' }
      : getPendingHunterDeathFromMap(pendingDeaths);
    const partner = isLover ? yield* game.getPartner(playerSid) : null;
    const partnerIsHunter = partner?.getRole() === 'HUNTER';

    if (isHunter) {
      yield* audio.playAudio(
        isLover ? 'Day-vote/Hunter-is-lover' : 'Day-vote/Hunter'
      );
    } else if (isLover) {
      yield* audio.playAudio(
        partnerIsHunter ? 'Day-vote/Lover-partner-hunter' : 'Day-vote/Lover'
      );
    }

    if (pendingHunterDeath) {
      const victimSid = yield* runHunterChoice(pendingHunterDeath.sid);
      const victimIsLover = yield* game.isPlayerLover(victimSid);
      if (victimIsLover) {
        yield* audio.playAudio('Day-vote/Hunter-killed-lover');
      }
      yield* deathManager.addToPendingDeath('HUNTER_REVENGE', victimSid);
    }

    yield* finalizeDeathsAfterHunter();
  });

  const handleNonDayVoteDeath = Effect.fn('handleNonDayVoteDeath')(function* (
    cause: DeathCause,
    playerSid: string,
    isHunter: boolean
  ) {
    yield* deathManager.addToPendingDeath(cause, playerSid);
    const pendingDeaths = yield* deathManager.getPendingDeath;
    const pendingHunterDeath = isHunter
      ? { sid: playerSid, cause }
      : getPendingHunterDeathFromMap(pendingDeaths);
    if (pendingHunterDeath) {
      yield* handleHunterRevenge(pendingHunterDeath, true);
    }
    yield* finalizeDeathsAfterHunter();
  });

  const confirmAndAlertSingleDeath = Effect.fn('confirmAndAlertSingleDeath')(
    function* (playerSid: string, cause: DeathCause, isSheriffVote = false) {
      const player = yield* game.getPlayerBySocketId(playerSid);
      const isSheriff = yield* game.isSheriff(playerSid);
      if (isSheriff) {
        yield* game.setSheriffPlayer;
      }

      const isHunter = player.getRole() === 'HUNTER';
      if (cause === 'DAY_VOTE') {
        yield* handleDayVoteDeath(playerSid, isHunter);

        if (isSheriffVote) {
          yield* audio.playAudio('Day-vote/Village-go-back-sleep');
        }
        return;
      }
      yield* handleNonDayVoteDeath(cause, playerSid, isHunter);
    }
  );

  const promptHunter = (hunterSid: string) =>
    Effect.sync(() => io.to(hunterSid).emit('hunter:pick-required'));

  const runHunterChoice = Effect.fn('runHunterChoice')(function* (
    hunterSid: string,
    audioFile?: string
  ) {
    if (audioFile) {
      yield* audio.playAudio(audioFile);
    }
    const deferred = yield* Deferred.make<string>();
    hunterDeferred = deferred;
    yield* promptHunter(hunterSid);
    const victimSid = yield* Deferred.await(deferred);
    hunterDeferred = null;

    return victimSid;
  });

  const runHunterRevenge = Effect.fn('runHunterRevenge')(function* (
    hunterSid: string
  ) {
    return yield* runHunterChoice(hunterSid, 'Hunter/Hunter');
  });

  const alertOfWin = (list: Player[]) =>
    Effect.sync(() => {
      for (const player of list) {
        io.to(player.getSocketId()).emit('alert:player-won');
      }
    });

  const alertOfLoss = (list: Player[]) =>
    Effect.sync(() => {
      for (const player of list) {
        io.to(player.getSocketId()).emit('alert:player-lost');
      }
    });

  const alertWinnersAndLosers = Effect.fn('alertWinnersAndLosers')(function* (
    winner: 'villagers' | 'werewolves'
  ) {
    const players = yield* game.getPlayers;
    yield* audio.playWinnerAudio(winner);
    yield* Effect.log('playing winner audio');
    const werewolves = players.filter((p) => p.getRole() === 'WEREWOLF');
    const villagers = players.filter((p) => p.getRole() !== 'WEREWOLF');

    if (winner === 'villagers') {
      yield* alertOfWin(villagers);
      yield* alertOfLoss(werewolves);
    } else {
      yield* alertOfWin(werewolves);
      yield* alertOfLoss(villagers);
    }
  });

  const checkWinCondition = Effect.gen(function* () {
    const ended = yield* Ref.get(gameEndedAndAnnounced);
    if (ended) {
      return true;
    }

    const players = yield* game.getPlayers;
    const canWitchHeal = yield* game.canWitchHeal;
    const canWitchPoison = yield* game.canWitchKill;
    const winner = checkIfWinner(players, canWitchHeal, canWitchPoison);

    if (winner) {
      yield* alertWinnersAndLosers(winner);
      yield* Ref.set(gameEndedAndAnnounced, true);
      return true;
    }
    return false;
  });

  const promptCupid = Effect.gen(function* () {
    const cupid = yield* game.getCupid.pipe(Effect.orDie);
    io.to(cupid.getSocketId()).emit('cupid:pick-required');
  });

  const runCupidSegment = Effect.gen(function* () {
    yield* audio.playSegmentStart('CUPID');

    cupidDeferred = yield* Deferred.make<{
      lover1: string;
      lover2: string;
    }>();
    yield* promptCupid;
    const lovers = yield* Deferred.await(cupidDeferred);
    yield* game.setLovers(lovers.lover1, lovers.lover2);

    yield* audio.playSegmentEnd('CUPID');
    yield* markSegmentAsSkipped('CUPID');
  });

  const completeCupidSelection = Effect.fn('completeCupidSelection')(function* (
    lover1: string,
    lover2: string
  ) {
    if (cupidDeferred) {
      yield* Deferred.succeed(cupidDeferred, { lover1, lover2 });
    }
  });

  const promptWitchForPoison = Effect.gen(function* () {
    const witch = yield* game.getWitch.pipe(Effect.orDie);
    io.to(witch.getSocketId()).emit('witch:pick-poison-player');
  });

  const promptWitchForHeal = Effect.gen(function* () {
    const witch = yield* game.getWitch.pipe(Effect.orDie);
    const victim = yield* deathManager.getVictim('WEREWOLVES');
    io.to(witch.getSocketId()).emit('witch:can-heal', victim.getSocketId());
  });

  const promptLovers = Effect.gen(function* () {
    const LOVERS_REVEAL_DELAY = 5000;
    const LOVERS_ALERT_DELAY = 6000;

    const lovers = yield* game.getLovers.pipe(
      Effect.tapError((err) => Effect.logError(err))
    );

    yield* Effect.sleep(Duration.millis(LOVERS_REVEAL_DELAY));

    io.to(lovers[0].getSocketId()).emit(
      'alert:player-is-lover',
      lovers[1].getSocketId()
    );

    io.to(lovers[1].getSocketId()).emit(
      'alert:player-is-lover',
      lovers[0].getSocketId()
    );

    yield* Effect.sleep(Duration.millis(LOVERS_ALERT_DELAY));

    yield* Effect.log('emitting closing alert');
    for (const lover of lovers) {
      io.to(lover.getSocketId()).emit('alert:lovers-can-close-alert');
    }
  });

  const runLoverSegment = Effect.gen(function* () {
    yield* audio.playSegmentStart('LOVERS');

    loverDefer = yield* Deferred.make<void>();
    yield* promptLovers;
    yield* Deferred.await(loverDefer);

    yield* audio.playSegmentEnd('LOVERS');
    yield* markSegmentAsSkipped('LOVERS');
  });

  const completeLoversDefer = Effect.fn('completeLoversDefer')(function* () {
    if (loverDefer) {
      yield* Deferred.completeWith(loverDefer, Effect.void);
    }
  });

  const runWerewolfSegment = Effect.gen(function* () {
    yield* audio.playSegmentStart('WEREWOLF');
    werewolfVoteDeferred = yield* Deferred.make<string>();
    const werewolves = yield* game.getWerewolves;
    for (const wolf of werewolves) {
      io.to(wolf.getSocketId()).emit('werewolf:pick-required');
    }
    const victim = yield* Deferred.await(werewolfVoteDeferred);
    yield* deathManager.addToPendingDeath('WEREWOLVES', victim);
    yield* audio.playSegmentEnd('WEREWOLF');
  });

  const completeWerewolfVote = Effect.fn('completeWerewolfVote')(function* (
    victim: string
  ) {
    if (werewolfVoteDeferred) {
      yield* Deferred.succeed(werewolfVoteDeferred, victim);
    }
  });

  const promptSheriff = Effect.fn('promptSheriff')(function* (
    topVictims: string[]
  ) {
    const sheriffPlayer = yield* game.getSheriffPlayer;
    if (!sheriffPlayer) {
      yield* Effect.log('sheriff player not found inside Game');
      return yield* new SheriffPlayerNotFoundError();
    }

    io.to(sheriffPlayer).emit('day:sheriff-vote', topVictims);
  });

  const promptVillage = Effect.gen(function* () {
    const players = yield* game.getPlayers;
    const alivePlayers = players.filter((p) => p.isAlive);
    yield* Effect.log(
      `Prompting ${alivePlayers.length} alive players for day vote`
    );

    // Emit to each alive player individually
    for (const player of alivePlayers) {
      io.to(player.getSocketId()).emit('day:vote-required');
    }

    // Also broadcast to all connected sockets (for dashboard/admin)
    io.emit('day:voting-phase-start', {
      alivePlayerCount: alivePlayers.length,
      alivePlayers: alivePlayers.map((p) => ({
        name: p.getName(),
        socketId: p.getSocketId(),
      })),
    });
  });

  const completeDayVote = Effect.fn('completeDayVote')(function* (
    target: string,
    isSheriffVote = false
  ) {
    if (dayVoteDeferred) {
      yield* Deferred.succeed(dayVoteDeferred, {
        target,
        isSheriffVote,
      });
    }
  });

  const completeHunterKill = Effect.fn('completeHunterKill')(function* (
    target: string
  ) {
    if (hunterDeferred) {
      yield* Deferred.succeed(hunterDeferred, target);
    }
  });

  const runWitchHealSement = Effect.gen(function* () {
    yield* audio.playAudio('Witch/heeling-audio');
    witchHealDeferred = yield* Deferred.make<boolean>();
    yield* promptWitchForHeal;
    const didHeal = yield* Deferred.await(witchHealDeferred);
    if (didHeal) {
      yield* game.witchUsedHeal;
    }
  });

  const runWitchPoisonSegment = Effect.gen(function* () {
    yield* audio.playAudio('Witch/Witch-poison');
    witchPoisonDeferred = yield* Deferred.make<string | null>();
    yield* promptWitchForPoison;
    const poisonTarget = yield* Deferred.await(witchPoisonDeferred);
    if (poisonTarget) {
      yield* game.witchUsedKill;
      yield* deathManager.addToPendingDeath('WITCH_POISON', poisonTarget);
    }
    yield* audio.playAudio('Witch/Witch-end');
  });

  const runDayVoteTie = Effect.fn('runDayVoteTie')(function* (
    topVictims: string[]
  ) {
    yield* audio.playAudio('Day-vote/Day-vote-tie');
    dayVoteTieDeferred = yield* Deferred.make<string>();
    yield* promptSheriff(topVictims);
    const target = yield* Deferred.await(dayVoteTieDeferred);

    yield* completeDayVote(target, true);
    dayVoteTieDeferred = null;

    return target;
  });

  const runWitchSegment = Effect.gen(function* () {
    const canHeal = yield* game.canWitchHeal;
    const canPoison = yield* game.canWitchKill;

    yield* audio.playAudio('Witch/wake-up-witch');

    if (canHeal) {
      yield* runWitchHealSement;
    }

    if (canHeal && !canPoison) {
      yield* audio.playAudio('Witch/Witch-end');
      return;
    }

    if (canPoison) {
      yield* runWitchPoisonSegment;
    }

    const canHealAfter = yield* game.canWitchHeal;
    const canPoisonAfter = yield* game.canWitchKill;
    if (!(canHealAfter || canPoisonAfter)) {
      yield* markSegmentAsSkipped('WITCH');
    }
  });

  const completeWitchHeal = Effect.fn('completeWitchHeal')(function* (
    didHeal: boolean
  ) {
    if (witchHealDeferred) {
      yield* Deferred.succeed(witchHealDeferred, didHeal);
    }
  });

  const completeWitchPoison = Effect.fn('completeWitchPoison')(function* (
    target: string | null
  ) {
    if (witchPoisonDeferred) {
      yield* Deferred.succeed(witchPoisonDeferred, target);
    }
  });

  const completeDayVoteTie = Effect.fn('completeDayVoteTie')(function* (
    target: string
  ) {
    if (dayVoteTieDeferred) {
      yield* Deferred.succeed(dayVoteTieDeferred, target);
    }
  });

  return {
    startGame,
    getCurrentSegment,
    setCurrentSegment,
    markSegmentAsSkipped,
    loadMockScenario,
    runDayVoteTie,
    confirmAndAlertPlayerOfDeath,
    confirmAndAlertSingleDeath,
    checkWinCondition,
    completeCupidSelection,
    completeLoversDefer,
    completeWitchHeal,
    completeWitchPoison,
    completeWerewolfVote,
    completeDayVote,
    completeHunterKill,
    completeDayVoteTie,
  };
});

type GameFlowService = typeof makeGameFlow extends Effect.Effect<
  infer A,
  unknown,
  unknown
>
  ? A
  : never;

export class GameFlow extends Context.Tag('GameFlow')<
  GameFlow,
  GameFlowService
>() {
  static readonly DefaultWithoutDependencies = Layer.effect(this, makeGameFlow);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(Game.Default),
    Layer.provide(Lobby.Default),
    Layer.provide(SocketServer.Default),
    Layer.provide(AudioManager.Default),
    Layer.provide(DeathManager.Default),
    Layer.provide(DayVote.Default)
  );
}

const findNextSegment = (segments: Segment[], currentIndex: number) => {
  const STARTING_INDEX_NONE_FIRST_NIGHT = 2;
  let idx = currentIndex;

  while (idx < segments.length && segments[idx].skip) {
    console.log(`the current segment is ${segments[idx]}`);
    idx++;
  }

  if (idx >= segments.length) {
    idx = STARTING_INDEX_NONE_FIRST_NIGHT;
    while (idx < segments.length && segments[idx].skip) {
      idx++;
    }
  }

  return idx;
};
