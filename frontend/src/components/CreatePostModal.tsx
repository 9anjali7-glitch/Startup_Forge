import { X, Image, Video, FileText, AtSign, Smile, Plus } from 'lucide-react';
import { User } from '../App';
import { useState, useRef } from 'react';

type CreatePostModalProps = {
  currentUser: User;
  users: User[];
  onClose: () => void;
  onPost: (content: string, image?: string, attachment?: { type: 'video' | 'document'; data: string; name: string }) => void;
};

export function CreatePostModal({ currentUser, users, onClose, onPost }: CreatePostModalProps) {
  const [content, setContent] = useState('');
  const [image, setImage] = useState<string | undefined>();
  const [attachment, setAttachment] = useState<{ type: 'video' | 'document'; data: string; name: string } | undefined>();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { window.alert('Please choose a file smaller than 25 MB.'); e.target.value = ''; return; }
    const type = file.type.startsWith('video/') ? 'video' : 'document';
    const reader = new FileReader();
    reader.onloadend = () => setAttachment({ type, data: reader.result as string, name: file.name });
    reader.readAsDataURL(file);
  };

  const handleMention = (userName: string) => {
    const lastAtIndex = content.lastIndexOf('@');
    const newContent = content.substring(0, lastAtIndex) + `@${userName} `;
    setContent(newContent);
    setShowMentions(false);
    setMentionSearch('');
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    
    // Check if user is typing a mention
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1 && lastAtIndex === value.length - 1) {
      setShowMentions(true);
      setMentionSearch('');
    } else if (lastAtIndex !== -1 && value[lastAtIndex] === '@') {
      const searchText = value.substring(lastAtIndex + 1);
      if (!searchText.includes(' ')) {
        setMentionSearch(searchText);
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const filteredUsers = mentionSearch
    ? users.filter(u => u.name.toLowerCase().includes(mentionSearch.toLowerCase()))
    : users;

  const handlePost = () => {
    if (content.trim()) {
      onPost(content, image, attachment);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl text-gray-900">Create a post</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-900 p-1">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* User Info */}
        <div className="px-6 py-4 flex items-center gap-3">
          <img src={currentUser.avatar} alt={currentUser.name} className="w-12 h-12 rounded-full" />
          <div>
            <p className="text-gray-900">{currentUser.name}</p>
            <select className="text-sm border border-gray-300 rounded px-2 py-1 mt-1">
              <option>Anyone</option>
              <option>Connections only</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-4 relative">
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="What do you want to talk about?"
            className="w-full min-h-[200px] resize-none focus:outline-none text-gray-900"
            autoFocus
          />

          {/* Mentions Dropdown */}
          {showMentions && filteredUsers.length > 0 && (
            <div className="absolute top-full left-6 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
              {filteredUsers.slice(0, 5).map(user => (
                <button
                  key={user.id}
                  onClick={() => handleMention(user.name)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 text-left"
                >
                  <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" />
                  <div>
                    <div className="text-sm text-gray-900">{user.name}</div>
                    <div className="text-xs text-gray-600 truncate">{user.headline}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {attachment && <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm"><span className="truncate">{attachment.type === 'video' ? 'Video' : 'Document'}: {attachment.name}</span><button type="button" onClick={() => setAttachment(undefined)} className="ml-3 text-slate-500 hover:text-red-600">Remove</button></div>}

          {/* Image Preview */}
          {image && (
            <div className="relative mt-4">
              <img src={image} alt="Upload preview" className="w-full rounded-lg" />
              <button
                onClick={() => setImage(undefined)}
                className="absolute top-2 right-2 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          )}
        </div>

        {/* Add to Post */}
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Add to your post</span>
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-gray-100 rounded text-green-600"
                title="Add photo"
              >
                <Image className="w-5 h-5" />
              </button>
              <button type="button" onClick={() => { if (mediaInputRef.current) { mediaInputRef.current.accept = 'video/*'; mediaInputRef.current.click(); } }} className="p-2 hover:bg-gray-100 rounded text-blue-600" title="Add video"><Video className="w-5 h-5" /></button>
              <button type="button" onClick={() => { if (mediaInputRef.current) { mediaInputRef.current.accept = 'application/pdf,.doc,.docx,.txt'; mediaInputRef.current.click(); } }} className="p-2 hover:bg-gray-100 rounded text-orange-600" title="Add document"><FileText className="w-5 h-5" /></button>
              <button 
                onClick={() => {
                  setContent(content + '@');
                  setShowMentions(true);
                }}
                className="p-2 hover:bg-gray-100 rounded text-gray-600" 
                title="Mention someone"
              >
                <AtSign className="w-5 h-5" />
              </button>
              <button type="button" onClick={() => setShowEmojiPicker(v => !v)} className="p-2 hover:bg-gray-100 rounded text-yellow-600" title="Add emoji"><Smile className="w-5 h-5" /></button>
            </div>
          </div>
          {showEmojiPicker && <div className="mt-3 flex gap-2">{['😀', '🎉', '🚀', '💡', '💰'].map(emoji => <button type="button" key={emoji} onClick={() => { setContent(value => `${value}${emoji}`); setShowEmojiPicker(false); }} className="rounded-lg p-2 hover:bg-gray-100 text-xl">{emoji}</button>)}</div>}
          <input ref={mediaInputRef} type="file" accept="video/*,application/pdf,.doc,.docx,.txt" onChange={handleMediaUpload} className="hidden" />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={handlePost}
            disabled={!content.trim()}
            className={`px-8 py-2 rounded-full ${
              content.trim()
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
