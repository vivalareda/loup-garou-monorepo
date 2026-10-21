import { isRoomCode, normalizeRoomCode } from '@repo/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createAndOpenRoom, openRoom, roomCode } from '@/utils/room-url';

/** Which room this tab is on, and switching to another or a new one. */
export function RoomPanel() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const isValid = isRoomCode(normalizeRoomCode(code));

  const handleCreate = () => {
    setError(null);
    createAndOpenRoom().catch((failure) => {
      setError(`Could not create a room: ${String(failure)}`);
    });
  };

  return (
    <div className="border-b border-gray-200 bg-white p-4">
      <h3 className="mb-1 text-sm font-semibold text-gray-700">🚪 Room</h3>
      <p className="mb-3 font-mono text-lg font-bold text-gray-900">
        {roomCode}
      </p>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();

          if (isValid) {
            openRoom(code);
          }
        }}
      >
        <input
          className="w-full rounded border border-gray-300 px-2 text-sm"
          onChange={(event) => setCode(event.target.value)}
          placeholder="Room code"
          value={code}
        />
        <Button disabled={!isValid} size="sm" type="submit" variant="outline">
          Open
        </Button>
      </form>
      <Button
        className="mt-2 w-full text-xs"
        onClick={handleCreate}
        size="sm"
        variant="outline"
      >
        + New room
      </Button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
