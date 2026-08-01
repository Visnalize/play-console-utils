import Toastify from 'toastify-js';

export interface ToastHandle {
  hide: () => void;
}

export function showToast(
  message: string,
  opts: { sticky?: boolean } = {},
): ToastHandle {
  const toast = Toastify({
    text: message,
    duration: opts.sticky ? -1 : 2500,
    gravity: 'bottom',
    position: 'right',
    close: false,
    stopOnFocus: false,
    style: {
      background: '#333',
      borderRadius: '8px',
    },
  });
  toast.showToast();
  return { hide: () => toast.hideToast() };
}
