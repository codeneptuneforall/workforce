import type * as React from 'react';
import { Logo } from '../ui/Logo';

export function AuthLayout({ children }: {children: React.ReactNode;}) {
  return (
    <div className="flex min-h-screen w-full bg-canvas">
      <div className="hidden w-[42%] flex-col justify-between bg-brand-800 p-12 text-white lg:flex">
        <Logo inverted />
        <div className="max-w-md">
          <p className="text-3xl font-semibold leading-tight tracking-tight">Track the workday.<br />Close the month with confidence.</p>
          <p className="mt-4 text-sm leading-relaxed text-brand-100">
            Time tracking, attendance, leave and payroll for the Code Neptune team — with every adjustment explained and recorded.
          </p>
        </div>
        <p className="text-xs text-brand-200">Code Neptune Technologies Pvt. Ltd. · Internal use only</p>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo /></div>
          {children}
        </div>
      </div>
    </div>);

}