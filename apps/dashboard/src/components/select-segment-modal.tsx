import type { SegmentType } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SelectSegmentModalProps = {
  isOpen: boolean;
  mockSegment: SegmentType | undefined;
  onClose: () => void;
  setMockSegment: (segment: SegmentType) => void;
};

export function SelectSegmentModal({
  isOpen,
  mockSegment,
  onClose,
  setMockSegment,
}: SelectSegmentModalProps) {
  const handleValueChange = (value: SegmentType) => {
    setMockSegment(value);
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select segement">
      <div className="flex gap-2 justify-center">
        <Select onValueChange={handleValueChange} value={mockSegment}>
          <SelectTrigger className="w-full max-w-48">
            <SelectValue placeholder="Select a segment" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Segments</SelectLabel>
              <SelectItem value="CUPID">Cupid</SelectItem>
              <SelectItem value="LOVERS">Lovers</SelectItem>
              <SelectItem value="WEREWOLF">Werewolf</SelectItem>
              <SelectItem value="WITCH">Witch</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>

        <Button onClick={handleClose}>Apply</Button>
      </div>
    </Modal>
  );
}
