/**
 * React hook for managing TerminalFormatter lifecycle
 * Provides format, reset, flush functions with proper memoization
 */

import { useMemo, useCallback } from 'react';
import { TerminalFormatter } from '../../shared/terminal-formatter';

/**
 * Hook for markdown-to-ANSI formatting in terminal components
 *
 * @param enabled - Whether formatting is enabled (default: true)
 * @returns Format, reset, and flush functions
 *
 * @example
 * ```tsx
 * const { format, reset } = useTerminalFormatter(true);
 *
 * // On new WebSocket connection
 * reset();
 *
 * // Format incoming data
 * const formatted = format(incomingData);
 * ```
 */
export function useTerminalFormatter(enabled: boolean = true) {
  // Fix 8: Only depend on `enabled` (no unstable options object)
  const formatter = useMemo(() => {
    return new TerminalFormatter({
      enabled,
      preserveExistingAnsi: true,
      semanticColors: true,
    });
  }, [enabled]);

  const format = useCallback(
    (data: string): string => {
      if (!enabled || !data) {
        return data;
      }

      try {
        return formatter.format(data);
      } catch (error) {
        console.error('TerminalFormatter error:', error);
        return data;
      }
    },
    [formatter]
  );

  const reset = useCallback(() => {
    formatter.reset();
  }, [formatter]);

  const flush = useCallback((): string => {
    try {
      return formatter.flush();
    } catch (error) {
      console.error('TerminalFormatter flush error:', error);
      return '';
    }
  }, [formatter]);

  return { format, reset, flush, enabled };
}
