import React from 'react';
import { CalendarDays } from 'lucide-react';

interface DatePickerInputProps {
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    required?: boolean;
    className?: string;
}

export function DatePickerInput({ name, value, onChange, placeholder, required, className }: DatePickerInputProps) {
    // Determines if the value is a valid ISO date YYYY-MM-DD
    const isISODate = (val: string) => /^\d{4}-\d{2}-\d{2}$/.test(val);

    const displayValue = isISODate(value) ? value.split('-').reverse().join('/') : value;

    return (
        <div className="relative flex items-center w-full">
            {/* The actual visible input which acts as text fallback and shows formatted date */}
            <input
                type="text"
                name={name}
                value={displayValue}
                readOnly
                className={`pr-10 cursor-pointer ${className}`}
                placeholder={placeholder}
                required={required}
            />
            
            {/* Container for the icon and the hidden native date picker */}
            <div className="absolute inset-0 w-full h-full flex items-center justify-end pr-3 text-slate-400 hover:text-uems-blue transition-colors overflow-hidden rounded-[1rem]">
                <CalendarDays className="w-5 h-5 pointer-events-none" />
                <input
                    type="date"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    value={isISODate(value) ? value : ''}
                    onChange={(e) => {
                        onChange({
                            target: { name, value: e.target.value }
                        } as any);
                    }}
                    title="Selecionar Data"
                />
            </div>
        </div>
    );
}
