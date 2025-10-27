import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UI_CONSTANTS } from '@/lib/constants';

interface CRSelectProps {
  value: number;
  onValueChange: (value: number) => void;
  label: string;
  placeholder?: string;
}

// Standard D&D 5e Challenge Ratings
const STANDARD_CRS = [
  { value: 0, label: '0' },
  { value: 0.125, label: '1/8' },
  { value: 0.25, label: '1/4' },
  { value: 0.5, label: '1/2' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6' },
  { value: 7, label: '7' },
  { value: 8, label: '8' },
  { value: 9, label: '9' },
  { value: 10, label: '10' },
  { value: 11, label: '11' },
  { value: 12, label: '12' },
  { value: 13, label: '13' },
  { value: 14, label: '14' },
  { value: 15, label: '15' },
  { value: 16, label: '16' },
  { value: 17, label: '17' },
  { value: 18, label: '18' },
  { value: 19, label: '19' },
  { value: 20, label: '20' },
  { value: 21, label: '21' },
  { value: 22, label: '22' },
  { value: 23, label: '23' },
  { value: 24, label: '24' },
  { value: 25, label: '25' },
  { value: 26, label: '26' },
  { value: 27, label: '27' },
  { value: 28, label: '28' },
  { value: 29, label: '29' },
  { value: 30, label: '30' }
];

export function CRSelect({ value, onValueChange, label, placeholder }: CRSelectProps) {
  return (
    <div className="space-y-2">
      <label className={UI_CONSTANTS.FIELD_LABEL_STYLES}>
        {label}
      </label>
      <Select 
        value={value.toString()} 
        onValueChange={(val) => onValueChange(parseFloat(val))}
      >
        <SelectTrigger className={UI_CONSTANTS.FIELD_STYLES}>
          <SelectValue placeholder={placeholder || `Select ${label}`} />
        </SelectTrigger>
        <SelectContent>
          {STANDARD_CRS.map((cr) => (
            <SelectItem key={cr.value} value={cr.value.toString()}>
              CR {cr.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
