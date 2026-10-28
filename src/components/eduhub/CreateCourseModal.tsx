import React, { useState, useEffect } from 'react';
import { EduHubCourse } from '../../types/eduhub';
import { X, GraduationCap, Check } from 'lucide-react';

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, description?: string, color?: string) => void;
  editingCourse?: EduHubCourse | null;
}

const COLOR_OPTIONS = [
  { id: 'terracotta', name: 'Terracotta', bg: 'bg-[#C25E3E]', border: 'border-[#C25E3E]' },
  { id: 'sage', name: 'Sage', bg: 'bg-[#4A7C59]', border: 'border-[#4A7C59]' },
  { id: 'ochre', name: 'Ochre', bg: 'bg-[#C28B3E]', border: 'border-[#C28B3E]' },
  { id: 'espresso', name: 'Espresso', bg: 'bg-[#3A2E2B]', border: 'border-[#3A2E2B]' },
  { id: 'blue', name: 'Ocean', bg: 'bg-[#2563EB]', border: 'border-[#2563EB]' },
  { id: 'purple', name: 'Amethyst', bg: 'bg-[#7C3AED]', border: 'border-[#7C3AED]' },
];

export const CreateCourseModal: React.FC<CreateCourseModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingCourse,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('terracotta');

  useEffect(() => {
    if (editingCourse) {
      setTitle(editingCourse.title);
      setDescription(editingCourse.description || '');
      setColor(editingCourse.color || 'terracotta');
    } else {
      setTitle('');
      setDescription('');
      setColor('terracotta');
    }
  }, [editingCourse, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit(title.trim(), description.trim() || undefined, color);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso-950/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-espresso-900 rounded-2xl border border-ivory-300 dark:border-espresso-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-ivory-300 dark:border-espresso-800 flex items-center justify-between bg-ivory-50/70 dark:bg-espresso-850">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-terracotta-100 dark:bg-terracotta-900/40 text-terracotta-700 dark:text-terracotta-300">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-espresso-950 dark:text-ivory-50">
                {editingCourse ? 'Edit Course Details' : 'Create New Course'}
              </h3>
              <p className="text-[11px] text-espresso-500 dark:text-espresso-400">
                Organize YouTube video lectures into structured courses
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-espresso-400 hover:text-espresso-700 dark:hover:text-ivory-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-espresso-800 dark:text-ivory-100">
              Course Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Advanced Fluid Dynamics"
              className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50/60 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50 placeholder:text-espresso-400 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-espresso-800 dark:text-ivory-100 flex items-center justify-between">
              <span>Description &amp; Syllabus Topics</span>
              <span className="text-[10px] text-espresso-400">Optional</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Mechanical engineering university curriculum, weekly lecture series..."
              className="w-full px-3 py-2 rounded-xl border border-ivory-300 dark:border-espresso-700 bg-ivory-50/60 dark:bg-espresso-850 text-xs text-espresso-950 dark:text-ivory-50 placeholder:text-espresso-400 focus:outline-none focus:ring-2 focus:ring-terracotta-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-espresso-800 dark:text-ivory-100">
              Color Accent
            </label>
            <div className="flex items-center gap-2.5 pt-1">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className={`w-7 h-7 rounded-full ${c.bg} flex items-center justify-center text-white transition hover:scale-110 cursor-pointer ${
                    color === c.id ? 'ring-2 ring-offset-2 ring-terracotta-500 scale-105' : 'opacity-80'
                  }`}
                  title={c.name}
                >
                  {color === c.id && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-ivory-200 dark:border-espresso-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium border border-ivory-300 dark:border-espresso-700 hover:bg-ivory-100 dark:hover:bg-espresso-800 text-espresso-700 dark:text-ivory-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-terracotta-600 hover:bg-terracotta-500 text-white shadow-subtle transition cursor-pointer"
            >
              {editingCourse ? 'Save Changes' : 'Create Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

