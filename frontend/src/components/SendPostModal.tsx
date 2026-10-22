import { X, Share2, Copy } from 'lucide-react';
import { Post } from '../App';
import { useState } from 'react';

type SendPostModalProps = { post: Post; onClose: () => void };

export function SendPostModal({ post, onClose }: SendPostModalProps) {
  const [status, setStatus] = useState('');
  const shareUrl = `${window.location.origin}/#post-${encodeURIComponent(post.id)}`;
  const shareText = `${post.userName}: ${post.content}`;

  const copyShare = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      setStatus('Post text and link copied to your clipboard.');
    } catch {
      setStatus('Clipboard access was blocked. Allow clipboard access or use your browser’s share option.');
    }
  };

  const sharePost = async () => {
    if (!navigator.share) { await copyShare(); return; }
    try {
      await navigator.share({ title: `Post by ${post.userName}`, text: shareText, url: shareUrl });
      onClose();
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') setStatus('Sharing was not completed. You can copy the post instead.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="share-post-title">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 id="share-post-title" className="text-xl font-semibold text-gray-900">Share post</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-600 hover:bg-gray-100"><X className="h-6 w-6" /></button>
        </div>
        <div className="p-6">
          <p className="line-clamp-4 whitespace-pre-wrap text-sm text-gray-700">{post.content}</p>
          <p className="mt-2 text-xs text-gray-500">By {post.userName}</p>
          {status && <p role="status" className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{status}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button type="button" onClick={copyShare} className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-5 py-2 text-gray-700 hover:bg-gray-50"><Copy className="h-4 w-4" />Copy text and link</button>
          <button type="button" onClick={sharePost} className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-white hover:bg-blue-700"><Share2 className="h-4 w-4" />Share</button>
        </div>
      </div>
    </div>
  );
}
