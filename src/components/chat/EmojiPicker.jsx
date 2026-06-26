import React, { useState } from 'react';
import { Search } from 'lucide-react';

const EMOJI_CATEGORIES = [
  {
    name: 'Smileys',
    icon: '😊',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌',
      '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓',
      '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖',
      '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱',
      '😨', '😰', '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🫢', '🤫', '🤥', '😶', '😐', '😑',
      '😬', '🫠', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '😵‍💫'
    ]
  },
  {
    name: 'Gestures',
    icon: '👋',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙',
      '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌',
      '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾'
    ]
  },
  {
    name: 'Hearts',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕',
      '💞', '💓', '💗', '💖', '💘', '💝', '💟', '🗣️', '👤', '👥', '🫂', '💋', '🧠', '🫀'
    ]
  },
  {
    name: 'Animals',
    icon: '🐱',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽',
      '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅',
      '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🕷️', '🕸️',
      'Scorpion (🦂)', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟',
      '🐬', '🐳', '🐋', '🦈', '🐊', '🐆', '🐅', '🐘', '🦣', '🦏', '🦛', '🐐', '🐏', '🐑',
      '🌱', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '🍀', '🍁', '🍂', '🍃', '🍄', '🌹', '🌻'
    ]
  },
  {
    name: 'Food',
    icon: '🍏',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭',
      '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒',
      '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🍳', '🥞', '🧇', '🥓',
      '🥩', '🍗', '🍖', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🥘', '🍲', '🥣', '🥗',
      '🍿', '🧈', '🧂', '🥫', '🍱', '🍙', '🍚', '🍛', '🍜', '🍝', '🍣', '🍤', '🍦', '🍩',
      '🍪', '🎂', '🍰', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '☕', '🍵', '🍶',
      '🍾', '🍷', '🍸', '🍹', '🍺', '🍻', '🥂', '🥃', '🥤', '🧋'
    ]
  },
  {
    name: 'Activities',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒',
      '🏑', '🥍', '🏏', '🏹', '🎣', '🤿', '🥊', '🥋', '🥅', '⛳', '⛸️', '⛷️', '🎯',
      '🪗', '🎮', '🕹️', '🎰', '🎲', '🧩', '🧸', '🪅', '🪩', '🪄', '🎨', '🖼️', '🎭', '🎫',
      '🎟️', '🎗️', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻'
    ]
  },
  {
    name: 'Objects',
    icon: '💡',
    emojis: [
      '💡', '🔦', '🕯️', '🔌', '🔋', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '📷',
      '📸', '📹', '🎥', '📽️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🧭', '⏱️', '⏰',
      '📅', '🗓️', '📦', '✉️', '📨', '📩', '📪', '📝', '💼', '📁', '📂', '📊', '📰', '📓',
      '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🔗', '📎', '📐', '📏', '📌', '📍', '✂️',
      '🔒', '🔓', '🔑', '🔨', '🪓', '🛡️', '🔧', '⚙️', '🩹', '💉', '💊', '🔬', '🛎️', '🧳'
    ]
  }
];

function EmojiPicker({ onSelect }) {
  const [activeCategory, setActiveCategory] = useState('Smileys');
  const [searchQuery, setSearchQuery] = useState('');

  // Handle emoji search
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Filter emojis based on search query
  const getFilteredEmojis = () => {
    if (!searchQuery.trim()) {
      return EMOJI_CATEGORIES.find(c => c.name === activeCategory)?.emojis || [];
    }

    // Flatten all emojis and search for character match
    const allEmojis = EMOJI_CATEGORIES.reduce((acc, cat) => [...acc, ...cat.emojis], []);
    return allEmojis.filter(emoji => emoji.includes(searchQuery));
  };

  const filteredEmojis = getFilteredEmojis();

  return (
    <div className="w-64 h-72 bg-zinc-900/95 backdrop-blur-md border border-zinc-800/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden select-none font-sans">
      {/* Search Input Bar */}
      <div className="p-2 border-b border-zinc-800/40 flex items-center gap-2 relative">
        <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-4" />
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search emojis..."
          className="w-full pl-7 pr-3 py-1.5 bg-zinc-950 border border-zinc-800/50 rounded-xl text-zinc-200 placeholder-zinc-500 text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition"
        />
      </div>

      {/* Category Tabs (hidden if searching) */}
      {!searchQuery.trim() && (
        <div className="flex justify-between px-2.5 py-1.5 bg-zinc-950/30 border-b border-zinc-850/40">
          {EMOJI_CATEGORIES.map(category => (
            <button
              key={category.name}
              type="button"
              onClick={() => setActiveCategory(category.name)}
              title={category.name}
              className={`text-sm p-1 rounded-lg hover:bg-zinc-800/60 transition ${
                activeCategory === category.name ? 'bg-zinc-800/80 scale-105 border border-zinc-700/50' : 'opacity-60 hover:opacity-100'
              }`}
            >
              {category.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emojis Grid Display */}
      <div className="flex-1 overflow-y-auto p-2.5 custom-scrollbar bg-zinc-950/20">
        {searchQuery.trim() && (
          <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-2 px-1">
            Search Results
          </div>
        )}
        <div className="grid grid-cols-7 gap-1.5">
          {filteredEmojis.map((emoji, idx) => (
            <button
              key={`${emoji}-${idx}`}
              type="button"
              onClick={() => onSelect(emoji)}
              className="text-lg hover:scale-130 transition duration-150 p-1.5 rounded-lg hover:bg-zinc-800/60 flex items-center justify-center"
            >
              {emoji}
            </button>
          ))}

          {filteredEmojis.length === 0 && (
            <div className="col-span-7 text-center py-10 text-zinc-500 text-[11px]">
              No emojis found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default EmojiPicker;
