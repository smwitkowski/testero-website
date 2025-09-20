"use client";

import React from 'react';
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Control, FieldPath, FieldValues } from "react-hook-form";

interface AuthFormFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  type: string;
  placeholder: string;
  autoComplete?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  onFocus?: () => void;
}

export function AuthFormField<TFieldValues extends FieldValues>({
  control,
  name,
  type,
  placeholder,
  autoComplete,
  autoFocus,
  disabled,
  onFocus,
}: AuthFormFieldProps<TFieldValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem>
          <div className="relative">
            <FormControl>
              <Input
                type={type}
                placeholder={placeholder}
                className={`px-4 py-3 min-h-[44px] text-base rounded-md transition-all duration-300 border-2 ${
                  fieldState.error 
                    ? "border-red-400 bg-red-50" 
                    : fieldState.isDirty && !fieldState.error
                      ? "border-green-400 bg-green-50" 
                      : "border-slate-300 focus:border-orange-400 focus:ring focus:ring-orange-200 focus:ring-opacity-50"
                }`}
                disabled={disabled}
                autoComplete={autoComplete}
                autoFocus={autoFocus}
                aria-required="true"
                aria-invalid={fieldState.error ? "true" : "false"}
                {...field}
                onFocus={onFocus}
              />
            </FormControl>
            
            {/* Validation icon */}
            {fieldState.isDirty && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                {fieldState.error ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            )}
          </div>
          <FormMessage className="text-left mt-1 font-medium" />
        </FormItem>
      )}
    />
  );
}