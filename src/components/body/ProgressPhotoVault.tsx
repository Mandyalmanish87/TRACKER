import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { ProgressPhotoEntry } from '../../types';
import {
  compressImageFile,
  storePhotoBlob,
  getPhotoBlob,
  deletePhotoBlob,
} from '../../utils/photoStorage';
import {
  Camera,
  Lock,
  Unlock,
  Trash2,
  Columns,
  Upload,
} from 'lucide-react';
import { Button } from '../common/Button';

export const ProgressPhotoVault: React.FC = () => {
  const { state, saveProgressPhoto, deleteProgressPhoto } = useApp();

  const [isPrivacyUnlocked, setIsPrivacyUnlocked] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'front' | 'side' | 'back' | 'custom'>('all');
  const [photoBlobs, setPhotoBlobs] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);

  // Comparison slider state
  const [isComparing, setIsComparing] = useState(false);
  const [beforePhotoId, setBeforePhotoId] = useState<string | null>(null);
  const [afterPhotoId, setAfterPhotoId] = useState<string | null>(null);
  const [sliderPosition, setSliderPosition] = useState<number>(50); // 0 to 100%

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadCategoryRef = useRef<'front' | 'side' | 'back' | 'custom'>('front');

  const photos = state.progressPhotos || [];

  // Photos are stored locally on this device only.
  useEffect(() => {
    let isMounted = true;
    const loadBlobs = async () => {
      const urls: Record<string, string> = {};
      for (const p of photos) {
        try {
          const storageId = p.storagePath?.startsWith('local_idb://')
            ? p.storagePath.replace('local_idb://', '')
            : p.id;

          let blob = await getPhotoBlob(storageId);
          if (!blob && storageId !== p.id) {
            blob = await getPhotoBlob(p.id);
          }

          if (blob && isMounted) {
            urls[p.id] = URL.createObjectURL(blob);
          }
        } catch {
          // Photo missing or corrupted in store
        }
      }
      if (isMounted) {
        setPhotoBlobs(urls);
      }
    };

    loadBlobs();

    return () => {
      isMounted = false;
      Object.values(photoBlobs).forEach((u) => {
        if (u.startsWith('blob:')) URL.revokeObjectURL(u);
      });
    };
  }, [photos.length]);

  const filteredPhotos = photos.filter((p) => {
    if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
    return true;
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { compressedBlob, thumbnailDataUrl } = await compressImageFile(file, 1600, 0.85);
      const photoId = `photo-${Date.now()}`;
      await storePhotoBlob(photoId, compressedBlob);

      saveProgressPhoto({
        id: photoId,
        date: new Date().toISOString().split('T')[0],
        category: uploadCategoryRef.current,
        storagePath: `local_idb://${photoId}`,
        thumbnailDataUrl,
        weightKgAtCapture: state.nutritionProfile?.weightKg,
        isPrivateLocked: true,
      });

      // Update in-memory blob URL
      const blobUrl = URL.createObjectURL(compressedBlob);
      setPhotoBlobs((prev) => ({ ...prev, [photoId]: blobUrl }));
    } catch (err) {
      console.error('Failed to store progress photo:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (photo: ProgressPhotoEntry) => {
    if (!confirm('Are you sure you want to permanently delete this progress photo?')) return;
    deleteProgressPhoto(photo.id);

    const storageId = photo.storagePath?.startsWith('local_idb://')
      ? photo.storagePath.replace('local_idb://', '')
      : photo.id;

    await deletePhotoBlob(storageId);
    if (storageId !== photo.id) {
      await deletePhotoBlob(photo.id);
    }

    setPhotoBlobs((prev) => {
      const copy = { ...prev };
      delete copy[photo.id];
      delete copy[storageId];
      return copy;
    });
  };

  const beforePhoto = photos.find((p) => p.id === beforePhotoId) || photos[photos.length - 1];
  const afterPhoto = photos.find((p) => p.id === afterPhotoId) || photos[0];

  return (
    <div className="space-y-5">
      {/* Vault Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-terracotta-100 dark:bg-terracotta-900/40 text-terracotta-600 dark:text-terracotta-400 flex items-center justify-center">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-espresso-950 dark:text-ivory-50">
              Private Progress Photo Vault
            </h3>
            <p className="text-xs text-espresso-500 dark:text-espresso-400">
              Encrypted on-device client storage with split-screen before/after comparison
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Privacy Toggle Button */}
          <Button
            variant={isPrivacyUnlocked ? 'primary' : 'secondary'}
            size="sm"
            icon={isPrivacyUnlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            onClick={() => setIsPrivacyUnlocked(!isPrivacyUnlocked)}
          >
            {isPrivacyUnlocked ? 'Vault Unlocked' : 'Vault Blurred (Privacy)'}
          </Button>

          {/* Compare Button */}
          {photos.length >= 2 && (
            <Button
              variant={isComparing ? 'primary' : 'secondary'}
              size="sm"
              icon={<Columns className="w-3.5 h-3.5" />}
              onClick={() => setIsComparing(!isComparing)}
            >
              Compare
            </Button>
          )}

          {/* Upload Button */}
          <Button
            variant="primary"
            size="sm"
            icon={<Upload className="w-3.5 h-3.5" />}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? 'Compressing...' : 'Upload Photo'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Comparison Split-Screen Slider View */}
      {isComparing && photos.length >= 2 && (
        <div className="p-5 rounded-2xl border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-ivory-200 dark:border-espresso-750 pb-3">
            <span className="font-bold text-sm text-espresso-950 dark:text-ivory-50 flex items-center gap-2">
              <Columns className="w-4 h-4 text-terracotta-500" />
              Before &amp; After Progression Slider
            </span>
            <div className="flex items-center gap-3 text-xs font-mono">
              <select
                value={beforePhoto?.id}
                onChange={(e) => setBeforePhotoId(e.target.value)}
                className="px-2 py-1 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
              >
                {photos.map((p) => (
                  <option key={p.id} value={p.id}>
                    Before: {p.date} ({p.category})
                  </option>
                ))}
              </select>

              <select
                value={afterPhoto?.id}
                onChange={(e) => setAfterPhotoId(e.target.value)}
                className="px-2 py-1 rounded-lg border border-ivory-300 dark:border-espresso-700 bg-white dark:bg-espresso-800 text-espresso-900 dark:text-ivory-100"
              >
                {photos.map((p) => (
                  <option key={p.id} value={p.id}>
                    After: {p.date} ({p.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Interactive Split View Container */}
          <div className="relative w-full h-80 sm:h-96 rounded-xl overflow-hidden select-none bg-espresso-950 border border-ivory-200/20">
            {/* After Image (Background) */}
            <div className="absolute inset-0">
              {afterPhoto && (photoBlobs[afterPhoto.id] || afterPhoto.thumbnailDataUrl) ? (
                <img
                  src={photoBlobs[afterPhoto.id] || afterPhoto.thumbnailDataUrl}
                  alt="After"
                  className={`w-full h-full object-contain ${!isPrivacyUnlocked ? 'blur-md' : ''}`}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-ivory-400">
                  After photo loading...
                </div>
              )}
              <span className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-espresso-900/80 text-white font-bold">
                After ({afterPhoto?.date})
              </span>
            </div>

            {/* Before Image (Clipped Left Layer) */}
            <div
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${sliderPosition}%` }}
            >
              <div className="w-full h-full relative" style={{ width: '100%' }}>
                {beforePhoto && (photoBlobs[beforePhoto.id] || beforePhoto.thumbnailDataUrl) && (
                  <img
                    src={photoBlobs[beforePhoto.id] || beforePhoto.thumbnailDataUrl}
                    alt="Before"
                    className={`w-full h-full object-contain ${!isPrivacyUnlocked ? 'blur-md' : ''}`}
                  />
                )}
                <span className="absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-espresso-900/80 text-white font-bold">
                  Before ({beforePhoto?.date})
                </span>
              </div>
            </div>

            {/* Divider Handle */}
            <div
              className="absolute inset-y-0 w-1 bg-white cursor-ew-resize shadow-[0_0_10px_rgba(0,0,0,0.5)]"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white text-espresso-900 flex items-center justify-center text-xs font-bold shadow-md">
                ⇄
              </div>
            </div>

            {/* Range Slider for Mobile Accessibility */}
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPosition}
              onChange={(e) => setSliderPosition(parseFloat(e.target.value))}
              className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full"
            />
          </div>
          <p className="text-center text-xs text-espresso-400 font-mono">
            Drag the slider horizontally to compare body recomposition
          </p>
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {(['all', 'front', 'side', 'back', 'custom'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl font-mono uppercase transition-colors ${
              selectedCategory === cat
                ? 'bg-terracotta-600 text-white font-semibold'
                : 'border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 text-espresso-700 dark:text-ivory-200 hover:border-ivory-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Photos Grid */}
      {filteredPhotos.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed border-ivory-200 dark:border-espresso-750 rounded-2xl bg-white dark:bg-espresso-850 space-y-3">
          <Camera className="w-10 h-10 mx-auto text-espresso-300 dark:text-espresso-600" />
          <p className="font-semibold text-sm text-espresso-950 dark:text-ivory-50">
            No progress photos uploaded yet
          </p>
          <p className="text-xs text-espresso-500 dark:text-espresso-400 max-w-sm mx-auto">
            Take consistent monthly photos under identical lighting to visually monitor progressive muscle hypertrophy.
          </p>
          <Button
            variant="primary"
            size="sm"
            icon={<Upload className="w-4 h-4" />}
            onClick={() => fileInputRef.current?.click()}
          >
            Upload First Photo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredPhotos.map((photo) => {
            const blobUrl = photoBlobs[photo.id] || photo.thumbnailDataUrl;

            return (
              <div
                key={photo.id}
                className="group relative rounded-2xl overflow-hidden border border-ivory-200 dark:border-espresso-750 bg-white dark:bg-espresso-850 shadow-subtle flex flex-col"
              >
                {/* Photo Image with Privacy Blur */}
                <div className="relative aspect-[3/4] bg-espresso-950 overflow-hidden">
                  {blobUrl ? (
                    <img
                      src={blobUrl}
                      alt={`Progress photo - ${photo.category}`}
                      className={`w-full h-full object-cover transition-all duration-300 ${
                        !isPrivacyUnlocked ? 'blur-lg scale-105' : 'group-hover:scale-102'
                      }`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-ivory-400">
                      Loading...
                    </div>
                  )}

                  {!isPrivacyUnlocked && (
                    <div className="absolute inset-0 flex items-center justify-center bg-espresso-950/40">
                      <Lock className="w-6 h-6 text-white/80" />
                    </div>
                  )}

                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-espresso-900/80 text-white font-bold">
                    {photo.category}
                  </span>

                  <button
                    onClick={() => handleDelete(photo)}
                    title="Delete Photo"
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-espresso-900/80 text-white opacity-0 group-hover:opacity-100 hover:bg-rose-600 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Metadata Footer */}
                <div className="p-3 border-t border-ivory-200 dark:border-espresso-750 flex items-center justify-between text-xs font-mono">
                  <span className="text-espresso-700 dark:text-ivory-200 font-semibold">
                    {photo.date}
                  </span>
                  {photo.weightKgAtCapture && (
                    <span className="text-espresso-400">
                      {photo.weightKgAtCapture} kg
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
