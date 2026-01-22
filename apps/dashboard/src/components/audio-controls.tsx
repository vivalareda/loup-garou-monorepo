import { Button } from '@/components/ui/button';
import { socket } from '@/utils/socket';

export function AudioControls() {
  const handleMockHunterEvent = () => {
    console.log('🎯 Testing Hunter death audio...');
    socket.emit('admin:mock-hunter-event');
  };

  const handleMockLoverEvent = () => {
    console.log('💕 Testing Lover death audio...');
    socket.emit('admin:mock-lover-event');
  };

  const handleMockLoverSecondHunterEvent = () => {
    console.log('💕🎯 Testing Lover dies, second is Hunter...');
    socket.emit('admin:mock-lover-second-hunter-event');
  };

  const handleMockLoverIsHunterEvent = () => {
    console.log('💕🎯 Testing Lover who IS Hunter dies...');
    socket.emit('admin:mock-lover-is-hunter-event');
  };

  const handleMockDayVoteHunterEvent = () => {
    console.log('🗳️🎯 Testing Village kills Hunter...');
    socket.emit('admin:mock-day-vote-hunter-event');
  };

  const handleMockDayVoteLoverEvent = () => {
    console.log('🗳️💕 Testing Village kills Lover...');
    socket.emit('admin:mock-day-vote-lover-event');
  };

  const handleMockDayVoteLoverIsHunterEvent = () => {
    console.log('🗳️💕🎯 Testing Village kills Lover who IS Hunter...');
    socket.emit('admin:mock-day-vote-lover-is-hunter-event');
  };

  const handleMockDayVoteLoverSecondHunterEvent = () => {
    console.log('🗳️💕🎯 Testing Village kills Lover, second is Hunter...');
    socket.emit('admin:mock-day-vote-lover-second-hunter-event');
  };

  return (
    <div className="border-b border-gray-200 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-600">
        🔊 Audio Testing
      </h3>
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-gray-500">Pre Day Vote</h4>
        <Button
          className="w-full text-xs"
          onClick={handleMockHunterEvent}
          size="sm"
          variant="outline"
        >
          🎯 Werewolf kills Hunter
        </Button>
        <Button
          className="w-full text-xs"
          onClick={handleMockLoverEvent}
          size="sm"
          variant="outline"
        >
          💕 Werewolf kills Lover
        </Button>
        <Button
          className="w-full text-xs"
          onClick={handleMockLoverSecondHunterEvent}
          size="sm"
          variant="outline"
        >
          💕🎯 Lover dies, 2nd is Hunter
        </Button>
        <Button
          className="w-full text-xs"
          onClick={handleMockLoverIsHunterEvent}
          size="sm"
          variant="outline"
        >
          💕🎯 Lover IS Hunter dies
        </Button>

        <h4 className="mt-3 text-xs font-medium text-gray-500">
          Post Day Vote
        </h4>
        <Button
          className="w-full text-xs"
          onClick={handleMockDayVoteHunterEvent}
          size="sm"
          variant="outline"
        >
          🗳️🎯 Village kills Hunter
        </Button>
        <Button
          className="w-full text-xs"
          onClick={handleMockDayVoteLoverEvent}
          size="sm"
          variant="outline"
        >
          🗳️💕 Village kills Lover
        </Button>
        <Button
          className="w-full text-xs"
          onClick={handleMockDayVoteLoverIsHunterEvent}
          size="sm"
          variant="outline"
        >
          🗳️💕🎯 Village kills Lover/Hunter
        </Button>
        <Button
          className="w-full text-xs"
          onClick={handleMockDayVoteLoverSecondHunterEvent}
          size="sm"
          variant="outline"
        >
          🗳️💕🎯 Village kills Lover, 2nd Hunter
        </Button>
      </div>
    </div>
  );
}
