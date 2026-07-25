import './toast.css';
import 'toastify-js/src/toastify.css';
import { initQuickReply } from './quick-reply';
import { initParseReview } from './parse-review';
import { CONSOLE_URL_MATCH_PATTERN } from '@/utils/console-url';

export default defineContentScript({
  matches: [CONSOLE_URL_MATCH_PATTERN],
  async main(ctx) {
    await Promise.all([initQuickReply(ctx), initParseReview(ctx)]);
  },
});
