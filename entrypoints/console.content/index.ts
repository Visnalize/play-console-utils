import './toast.css';
import { initQuickReply } from './quick-reply';
import { initParseReview } from './parse-review';

export default defineContentScript({
  matches: ['https://play.google.com/console/*'],
  async main(ctx) {
    await Promise.all([initQuickReply(ctx), initParseReview(ctx)]);
  },
});
