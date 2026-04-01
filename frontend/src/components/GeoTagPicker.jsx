import { useState, useMemo } from 'react';
import { Search as SearchIcon, X as XIcon, Check as CheckIcon, Filter as FilterIcon } from 'lucide-react';
import { ROUTE_CATEGORIES } from '../constants';
import clsx from 'clsx';

export default function GeoTagPicker({ value, onChange, label, sub }) {
    const [search, setSearch] = useState('');
    const [showAll, setShowAll] = useState(false);

    // Parse value string into array
    const selectedList = useMemo(() => 
        (value || '').split(',').map(s => s.trim()).filter(Boolean),
    [value]);

    // Filter categories based on search
    const filteredCategories = useMemo(() => {
        const query = search.toLowerCase();
        return ROUTE_CATEGORIES.filter(c => 
            c.toLowerCase().includes(query) || 
            c.replace('category-', '').toLowerCase().includes(query)
        );
    }, [search]);

    const toggleTag = (tag) => {
        let newList;
        if (selectedList.includes(tag)) {
            newList = selectedList.filter(t => t !== tag);
        } else {
            newList = [...selectedList, tag];
        }
        onChange(newList.join(', '));
    };

    const displayCategories = showAll ? filteredCategories : filteredCategories.slice(0, 18);

    return (
        <div className="space-y-3">
            <div className="flex items-end justify-between px-1">
                <div>
                   <label className="text-[10px] font-black text-neutral-900 dark:text-white uppercase tracking-widest block">{label}</label>
                   {sub && <p className="text-[9px] text-neutral-400 font-bold uppercase tracking-tight">{sub}</p>}
                </div>
                {selectedList.length > 0 && (
                    <button 
                        type="button"
                        onClick={() => onChange('')}
                        className="text-[9px] font-black uppercase text-danger hover:underline"
                    >
                        Clear All ({selectedList.length})
                    </button>
                )}
            </div>

            {/* Search Input */}
            <div className="relative group">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 group-focus-within:text-primary transition-colors" />
                <input 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="input pl-10 h-10 text-[11px] bg-neutral-50 dark:bg-neutral-950 border-neutral-100 dark:border-neutral-800"
                    placeholder="Search GeoTags (e.g. ir, ads, games...)"
                />
                {search && (
                    <button 
                        type="button" 
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800"
                    >
                        <XIcon className="w-3 h-3 text-neutral-400" />
                    </button>
                )}
            </div>

            {/* Selected Tags Area */}
            {selectedList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-primary/5 border border-primary/10">
                    {selectedList.map(tag => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => toggleTag(tag)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[9px] font-black uppercase tracking-widest shadow-apple-sm transition-transform hover:scale-95"
                        >
                            {tag.replace('category-', '')}
                            <XIcon className="w-2.5 h-2.5 opacity-60" strokeWidth={3} />
                        </button>
                    ))}
                </div>
            )}

            {/* Suggestions Grid */}
            <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                    {displayCategories.map(cat => {
                        const isSelected = selectedList.includes(cat);
                        if (isSelected) return null; // Don't show in suggestions if already selected
                        return (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => toggleTag(cat)}
                                className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-500 hover:border-primary/50 hover:text-primary transition-all"
                            >
                                {cat.replace('category-', '')}
                            </button>
                        );
                    })}
                </div>

                {filteredCategories.length > 18 && !showAll && !search && (
                    <button 
                        type="button"
                        onClick={() => setShowAll(true)}
                        className="w-full py-2 text-[9px] font-black uppercase text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors border-t border-dashed border-neutral-200 dark:border-neutral-800 mt-2"
                    >
                        + Show all {filteredCategories.length} categories
                    </button>
                )}

                {filteredCategories.length === 0 && (
                    <div className="py-4 text-center text-[10px] font-bold text-neutral-400 italic">
                        No matches found for "{search}"
                    </div>
                )}
            </div>
            
            {/* Manual Entry Fallback (for custom tags) */}
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 opacity-60">
                 <input 
                    value={value} 
                    onChange={e => onChange(e.target.value)} 
                    className="w-full bg-transparent border-none text-[9px] font-mono text-neutral-400 focus:ring-0 p-0" 
                    placeholder="Raw comma-separated tags..."
                 />
            </div>
        </div>
    );
}
