import React, { useState } from 'react';
import { X, Sparkles, Building, Layers, Calendar, BookOpen, KeyRound } from 'lucide-react';
import { useOptionalClassSpace } from '../../context/ClassSpaceContext';
import { useApp } from '../../context/AppContext';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (workspaceId: string) => void;
}

export const CreateWorkspaceModal: React.FC<CreateWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const classSpace = useOptionalClassSpace();
  const createWorkspace = classSpace?.createWorkspace;
  const { updateSettings } = useApp();

  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [section, setSection] = useState('');
  const [batch, setBatch] = useState('');
  const [department, setDepartment] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a name for the ClassSpace.');
      return;
    }

    if (!createWorkspace) {
      setError('ClassSpace context is unavailable.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await createWorkspace({
        name: name.trim(),
        institution: institution.trim() || undefined,
        section: section.trim() || undefined,
        batch: batch.trim() || undefined,
        department: department.trim() || undefined,
        description: description.trim() || undefined,
      });

      if (res.error) {
        setError(res.error);
      } else if (res.workspace) {
        updateSettings({ userMode: 'class_based' });
        onCreated?.(res.workspace.id);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create ClassSpace.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Create a ClassSpace</h2>
              <p className="text-xs text-muted-foreground">
                Set up a shared workspace for your class, section, or batch
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-lg text-xs font-medium bg-destructive/10 border border-destructive/30 text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              ClassSpace Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. B.Tech Computer Science — Batch 2026"
              className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-foreground"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
              <Building className="w-3.5 h-3.5 text-muted-foreground" />
              College / Institution (Optional)
            </label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. National Institute of Technology"
              className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-foreground"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                Section / Division
              </label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g. Section A"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                Batch / Academic Year
              </label>
              <input
                type="text"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="e.g. 2023–2027"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
              <Building className="w-3.5 h-3.5 text-muted-foreground" />
              Department / Faculty
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. School of Computer Engineering"
              className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-foreground"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Description / Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a brief summary for classmates, professors, or tutorial groups..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-foreground resize-none"
            />
          </div>

          <div className="p-3 rounded-xl bg-secondary/30 border border-border flex items-start gap-3">
            <KeyRound className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Automatic 5-character Join Code:</span> A unique, secure code (e.g. <span className="font-mono text-primary font-bold">CH7K2</span>) will be generated. You can share it with your classmates immediately.
            </div>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Creating...' : 'Create ClassSpace'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

