import React, { useState } from "react";
import System from "@/models/system";
import showToast from "@/utils/toast";

export default function PanoptoOptions() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);

    try {
      setLoading(true);
      showToast("Fetching Panopto videos and processing transcripts...", "info", {
        clear: true,
        autoClose: false,
      });

      const { data, error } = await System.dataConnectors.panopto.collect({
        university: form.get("university"),
        authToken: form.get("authToken"),
        folderId: form.get("folderId"),
      });

      if (!!error) {
        showToast(error, "error", { clear: true });
        setLoading(false);
        return;
      }

      showToast(
        `Successfully processed ${data.processedCount} videos. Output folder is ${data.destination}.`,
        "success",
        { clear: true }
      );
      e.target.reset();
      setLoading(false);
    } catch (e) {
      console.error(e);
      showToast(e.message, "error", { clear: true });
      setLoading(false);
    }
  };

  return (
    <div className="flex w-full">
      <div className="flex flex-col w-full px-1 md:pb-6 pb-16">
        <form className="w-full" onSubmit={handleSubmit}>
          <div className="w-full flex flex-col py-2">
            <div className="w-full flex flex-col gap-4">
              <div className="flex flex-col pr-10">
                <div className="flex flex-col gap-y-1 mb-4">
                  <label className="text-white text-sm font-bold">
                    University Name
                  </label>
                  <p className="text-xs font-normal text-white/50">
                    Your university's Panopto subdomain (e.g. 'harvard' for harvard.hosted.panopto.com)
                  </p>
                </div>
                <input
                  type="text"
                  name="university"
                  className="bg-zinc-900 text-white placeholder:text-white/20 text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                  placeholder="university-name"
                  required={true}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="flex flex-col pr-10">
                <div className="flex flex-col gap-y-1 mb-4">
                  <label className="text-white text-sm font-bold">Auth Token</label>
                  <p className="text-xs font-normal text-white/50">
                    Your Panopto authentication token
                  </p>
                </div>
                <input
                  type="password"
                  name="authToken"
                  className="bg-zinc-900 text-white placeholder:text-white/20 text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                  required={true}
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-col pr-10">
                <div className="flex flex-col gap-y-1 mb-4">
                  <label className="text-white text-sm font-bold">
                    Folder ID (Optional)
                  </label>
                  <p className="text-xs font-normal text-white/50">
                    Specific Panopto folder ID to process. Leave empty to process all accessible videos.
                  </p>
                </div>
                <input
                  type="text"
                  name="folderId"
                  className="bg-zinc-900 text-white placeholder:text-white/20 text-sm rounded-lg focus:outline-primary-button active:outline-primary-button outline-none block w-full p-2.5"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-y-2 w-full pr-10">
            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full justify-center border border-slate-200 px-4 py-2 rounded-lg text-dark-text text-sm font-bold items-center flex gap-x-2 bg-slate-200 hover:bg-slate-300 hover:text-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed"
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
      </div>
    </div>
  );
} 