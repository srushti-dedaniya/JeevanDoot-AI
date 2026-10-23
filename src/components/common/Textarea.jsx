import { forwardRef } from 'react';
import { cx } from '../../utils/helpers';

const Textarea = forwardRef(
  ({ label, error, required, className, wrapperClassName, ...props }, ref) => (
    <div className={cx('space-y-2', wrapperClassName)}>
      {label && (
        <label className="block text-label-lg font-semibold text-on-surface ml-1">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <textarea
          ref={ref}
          className={cx(
            'w-full min-h-[100px] bg-surface-container-low border border-outline-variant rounded-lg custom-input text-body-md text-on-surface caret-on-surface px-4 py-3 resize-y focus:outline-none placeholder:text-outline/70',
            error && 'border-error',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-sm text-error ml-1">{error}</p>}
    </div>
  )
);

Textarea.displayName = 'Textarea';

export default Textarea;