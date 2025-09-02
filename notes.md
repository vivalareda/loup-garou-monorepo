## Pre day vote
- [x] When lover dies, right segment plays
- [x] When hunter dies, right segment plays
- [x] First lover dies, but second lover is the hunter
- [x] First lover dies and is the hunter 

## Post day vote
- [ ] Village killed hunter
- [ ] Village killed lover
- [ ] Village killed lover which is the hunter
- [ ] Village killed lover but second lover is hunter
---

- Werewolves finish vote
- call finishSegment
    - plays audio
    - find next segment
    - starts next segment
- New segment starts, check if day
    - check if hunter is in death queue
        - if yes, runHunterSegment
            - find hunter
            - update hunter's list
            - alert player for pick
    - check if lover is in death queue
        - if yes, run loverSegment
            - plays right audio
            - if not game over, plays day segment
        
