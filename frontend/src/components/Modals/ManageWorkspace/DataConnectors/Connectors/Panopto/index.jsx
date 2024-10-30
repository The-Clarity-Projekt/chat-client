import React, { useState } from 'react';
import DataConnector from '../../../../../../models/dataConnector';
import paths from '../../../../../../utils/paths';

export default function PanoptoOptions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const formData = new FormData(e.target);
    const canvasUrl = formData.get('canvasUrl');
    const canvasToken = formData.get('canvasToken');
    const courseId = formData.get('courseId');

    const { error } = await DataConnector.panopto.collect({
      canvasUrl,
      canvasToken,
      courseId,
    });

    if (error) {
      setError(error);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col w-full">
      <div className="flex flex-col gap-y-4">
        <div>
          <div className="flex flex-col gap-y-1 mb-4">
            <label className="text-white text-sm font-bold">
              Canvas URL
            </label>
            <p className="text-xs font-normal text-white/50">
              Your Canvas instance URL (e.g., https://university.instructure.com)
            </p>
          </div>
          <input
            type="url"
            name="canvasUrl"
            required
            className="bg-zinc-900 text-white placeholder:text-white/20 text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
            placeholder="https://university.instructure.com"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div>
          <div className="flex flex-col gap-y-1 mb-4">
            <label className="text-white text-sm font-bold">
              Canvas Access Token
            </label>
            <p className="text-xs font-normal text-white/50">
              Your Canvas API access token. Generate this from your Canvas account settings.
            </p>
          </div>
          <input
            type="password"
            name="canvasToken"
            required
            className="bg-zinc-900 text-white placeholder:text-white/20 text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div>
          <div className="flex flex-col gap-y-1 mb-4">
            <label className="text-white text-sm font-bold">
              Course ID (Optional)
            </label>
            <p className="text-xs font-normal text-white/50">
              Specific Canvas course ID to process Panopto videos from. Leave empty to process all accessible courses.
            </p>
          </div>
          <input
            type="text"
            name="courseId"
            className="bg-zinc-900 text-white placeholder:text-white/20 text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      {error && (
        <p className="text-red-400 text-sm my-4">{error}</p>
      )}

      <div className="flex flex-col gap-y-2 w-full pr-10">
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full justify-center border border-slate-200 px-4 py-2 rounded-lg text-dark-text text-sm font-bold items-center flex gap-x-2 bg-slate-200 hover:bg-slate-300 hover:text-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {loading ? "Processing videos..." : "Process Panopto Videos"}
        </button>
        {loading && (
          <p className="text-xs text-white/50 max-w-sm">
            Processing may take some time depending on the number of videos.
            Transcripts will be available for embedding once complete.
          </p>
        )}
      </div>
    </form>
  );
} 