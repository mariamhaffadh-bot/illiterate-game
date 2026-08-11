import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

interface DisplayLinkProps {
  gameId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DisplayLinkModal({ gameId, isOpen, onClose }: DisplayLinkProps) {
  const [copied, setCopied] = useState(false);
  const displayUrl = `${window.location.origin}/#/display/${gameId}`;

  const copyLink = () => {
    navigator.clipboard.writeText(displayUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const openDisplay = () => {
    window.open(`/#/display/${gameId}`, '_blank');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Board Display</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Open this on your TV or second screen to show the board live.
            </p>

            {/* QR Code */}
            <div className="flex justify-center py-4">
              <div className="bg-white p-4 rounded-xl">
                <QRCodeSVG
                  value={displayUrl}
                  size={180}
                  level="M"
                  bgColor="#ffffff"
                  fgColor="#111827"
                />
              </div>
            </div>

            {/* URL display */}
            <div className="bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 mb-1">Display URL</p>
              <p className="text-sm font-mono text-gray-900 dark:text-white break-all">{displayUrl}</p>
            </div>

            {/* Game ID */}
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Game Code</p>
              <p className="text-3xl font-black tracking-widest text-gray-900 dark:text-white">{gameId}</p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={copyLink}
                className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={openDisplay}
                className="flex-1 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Open Display
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
