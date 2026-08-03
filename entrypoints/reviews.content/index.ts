import 'toastify-js/src/toastify.css';
import './style.css';
import { CONSOLE_URL_MATCH_PATTERN } from '@/utils/console-url';
import { initQuickReply } from './quick-reply';
import { initParseReview } from './parse-review';
import { initPicker } from './picker';
import { initNavigation } from './navigation';

export default defineContentScript({
  matches: [CONSOLE_URL_MATCH_PATTERN],
  async main(ctx) {
    await Promise.all([
      initQuickReply(ctx),
      initParseReview(ctx),
      initPicker(ctx),
      initNavigation(ctx),
    ]);
    console.log('ConsoleTurbo: review shortcuts active.');
  },
});
