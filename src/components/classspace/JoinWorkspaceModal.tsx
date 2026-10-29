import React, { useState, useEffect } from 'react';
import { X, LogIn, KeyRound, AlertCircle, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { useOptionalClassSpace } from '../../context/ClassSpaceContext';
import { useApp } from '../../context/AppContext';
import { normalizeJoinCode, isValidJoinCode } from '../../utils/classSpaceUtils';
import { classSpaceService } from '../../services/classSpaceService';
import { ClassSpaceWorkspace } from '../../types/classSpace';

interface JoinWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoined?: (workspaceId: string) => void;
}

export const JoinWorkspaceModal: React.FC<JoinWorkspaceModalProps> = ({
  isOpen,
  onClose,
  onJoined,
}) => {
  const classSpace = useOptionalClassSpace();
  const requestToJoinWorkspace = classSpace?.requestToJoinWorkspace;
  const joinWorkspaceByCode = classSpace?.joinWorkspaceByCode;
  const { updateSettings } = useApp();

  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewWs, setPreviewWs] = useState<ClassSpaceWorkspace | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedWorkspace, setSubmittedWorkspace] = useState<ClassSpaceWorkspace | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCode('');
      setError(null);
      setPreviewWs(null);
      setIsSubmitted(false);
      setSubmittedWorkspace(null);
    }
  }, [isOpen]);

  // Lookup workspace when code reaches 5 valid characters
  useEffect(() => {
    const normalized = normalizeJoinCode(code);
    if (normalized.length === 5 && isValidJoinCode(normalized)) {
      let isMounted = true;
      setIsLookingUp(true);
      setError(null);
      classSpaceService.lookupWorkspaceByCode(normalized)
        .then((res) => {
          if (!isMounted) return;
          if (res.workspace) {
            setPreviewWs(res.workspace);
          } else {
            setPreviewWs(null);
            if (res.error) setError(res.error);
          }
        })
        .catch(() => {
          if (isMounted) setPreviewWs(null);
        })
        .finally(() => {
          if (isMounted) setIsLookingUp(false);
        });
      return () => { isMounted = false; };
    } else {
      setPreviewWs(null);
    }
  }, [code]);

  if (!isOpen) return null;

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const rawVal = e.target.value;
    const normalized = normalizeJoinCode(rawVal);
    if (normalized.length <= 5) {
      setCode(normalized);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeJoinCode(code);

    if (normalized.length !== 5) {
      setError('Please enter a complete 5-character join code.');
      return;
    }

    if (!isValidJoinCode(normalized)) {
      setError('Invalid characters in join code. Must be alphanumeric characters (A-Z, 2-9).');
      return;
    }

    if (!requestToJoinWorkspace && !joinWorkspaceByCode) {
      setError('ClassSpace context is unavailable.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (requestToJoinWorkspace) {
        const res = await requestToJoinWorkspace(normalized);
        if (res.error) {
          setError(res.error);
        } else {
          setSubmittedWorkspace(res.workspace || previewWs || null);
          setIsSubmitted(true);
        }
      } else if (joinWorkspaceByCode) {
        const res = await joinWorkspaceByCode(normalized);
        if (res.error) {
          setError(res.error);
        } else if (res.workspace) {
          updateSettings({ userMode: 'class_based' });
          onJoined?.(res.workspace.id);
          onClose();
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to submit join request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div
          className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-6 text-center space-y-4 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Join Request Submitted</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Your request to join <span className="font-semibold text-foreground">{submittedWorkspace?.name || 'this ClassSpace'}</span> has been sent to the Class Representative (CR).
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-secondary/40 border border-border text-xs text-muted-foreground text-left space-y-1.5">
            <p className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
              <Clock className="w-4 h-4 text-primary" />
              What happens next?
            </p>
            <p className="text-[11px] leading-relaxed">
              To keep your classroom community secure and authentic, join requests are approved by the CR. You will automatically receive full access once approved.
            </p>
          </div>
          <button
            onClick={() => {
              setIsSubmitted(false);
              setCode('');
              onClose();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-md hover:bg-primary/90 transition-all cursor-pointer"
          >
            Understood
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <LogIn className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Join a ClassSpace</h2>
              <p className="text-xs text-muted-foreground">
                Enter the 5-character code shared by your Class Representative
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-lg text-xs font-medium bg-destructive/10 border border-destructive/30 text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-center space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1.5">
              <KeyRound className="w-4 h-4 text-primary" />
              ClassSpace Join Code
            </label>

            <div className="flex justify-center">
              <input
                type="text"
                value={code}
                onChange={handleCodeChange}
                placeholder="CH7K2"
                maxLength={5}
                autoFocus
                className="w-48 text-center text-3xl font-mono font-bold tracking-widest py-3 px-4 rounded-xl bg-background border-2 border-primary/50 focus:border-primary focus:ring-4 focus:ring-primary/20 transition-all text-primary uppercase placeholder:text-muted-foreground/30 shadow-inner"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Codes are 5 alphanumeric characters (e.g. <span className="font-mono font-semibold">CH7K2</span>). Not case-sensitive.
            </p>

            {isLookingUp && (
              <p className="text-xs text-muted-foreground animate-pulse">Verifying code with class registry...</p>
            )}

            {previewWs && (
              <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-left space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Found ClassSpace:</span>
                </div>
                <p className="text-sm font-bold text-foreground">{previewWs.name}</p>
                {(previewWs.department || previewWs.section || previewWs.batch) && (
                  <p className="text-xs text-muted-foreground">
                    {[previewWs.department, previewWs.section, previewWs.batch].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-xl bg-secondary/30 border border-border text-xs text-muted-foreground space-y-1.5">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              CR Approval Security:
            </div>
            <p className="text-[11px] leading-relaxed">
              Submitting your join code places a request directly on your Class Representative&apos;s roster. Once approved, the class timetable, community chat, and official notices are unlocked.
            </p>
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
              disabled={isSubmitting || code.length !== 5}
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Submitting Request...' : 'Request to Join'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
