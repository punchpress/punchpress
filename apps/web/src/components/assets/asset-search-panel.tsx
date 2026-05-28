import { ImagesIcon, Loader2Icon, PlusIcon, SearchIcon } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import {
  type Asset,
  getPreferredAssetFormat,
  importAsset,
  searchAssets,
} from "@/platform/assets/magnific-assets";
import { Button } from "../ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../ui/input-group";
import { ScrollArea } from "../ui/scroll-area";
import { showToast } from "../ui/toast";

export const getAssetTitle = (asset: Asset) => {
  return asset.title || `Asset #${asset.id}`;
};

export const AssetSearchPanel = ({
  onAddAsset,
  onAdded,
}: {
  onAddAsset: (
    asset: Asset,
    importedAsset: Awaited<ReturnType<typeof importAsset>>
  ) => Promise<void> | void;
  onAdded?: () => void;
}) => {
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [importingAssetId, setImportingAssetId] = useState<string | null>(null);
  const [status, setStatus] = useState("Search assets.");

  const hasMoreResults = page < lastPage;

  const runSearch = useCallback(
    async (nextPage = 1) => {
      const query = term.trim();
      const isFirstPage = nextPage === 1;

      if (!query) {
        setAssets([]);
        setPage(1);
        setLastPage(1);
        setStatus("Enter a search term.");
        return;
      }

      setLoading(true);
      setStatus(isFirstPage ? "Searching assets..." : "Loading more assets...");

      try {
        const result = await searchAssets(query, nextPage);
        const nextCurrentPage = result.meta?.current_page || nextPage;

        setAssets((currentAssets) => {
          if (isFirstPage) {
            return result.data;
          }

          const currentAssetIds = new Set(
            currentAssets.map((asset) => String(asset.id))
          );
          const newAssets = result.data.filter((asset) => {
            return !currentAssetIds.has(String(asset.id));
          });

          return [...currentAssets, ...newAssets];
        });
        setPage(nextCurrentPage);
        setLastPage(result.meta?.last_page || nextPage);
        setStatus(result.data.length > 0 ? "Search complete." : "No results.");
      } catch (error) {
        if (isFirstPage) {
          setAssets([]);
        }

        setStatus(error instanceof Error ? error.message : "Search failed.");
      } finally {
        setLoading(false);
      }
    },
    [term]
  );

  const addAsset = useCallback(
    async (asset: Asset) => {
      const format = getPreferredAssetFormat(asset);

      if (!format) {
        setStatus("This result has no supported download.");
        return;
      }

      setImportingAssetId(String(asset.id));
      setStatus(`Adding ${format.toUpperCase()} asset...`);

      try {
        const importedAsset = await importAsset(asset.id, format);
        await onAddAsset(asset, importedAsset);
        showToast({
          message: `Added ${getAssetTitle(asset)}`,
          type: "success",
        });
        setStatus(`Added ${getAssetTitle(asset)}.`);
        onAdded?.();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Import failed.";
        setStatus(message);
        showToast({
          message: `Asset import failed: ${message}`,
          priority: "high",
          type: "error",
        });
      } finally {
        setImportingAssetId(null);
      }
    },
    [onAddAsset, onAdded]
  );

  const loadMoreAssets = useCallback(() => {
    if (loading || !hasMoreResults || !term.trim()) {
      return;
    }

    runSearch(page + 1);
  }, [hasMoreResults, loading, page, runSearch, term]);

  const handleResultsScroll = useCallback(
    (event) => {
      const viewport = event.currentTarget;
      const remaining =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

      if (remaining < 360) {
        loadMoreAssets();
      }
    },
    [loadMoreAssets]
  );

  let resultsContent: ReactNode = null;

  if (loading && assets.length === 0) {
    resultsContent = (
      <AssetPanelEmpty icon={<Loader2Icon className="animate-spin" />}>
        Searching assets
      </AssetPanelEmpty>
    );
  } else if (assets.length === 0) {
    resultsContent = (
      <AssetPanelEmpty icon={<ImagesIcon />}>{status}</AssetPanelEmpty>
    );
  } else {
    resultsContent = (
      <>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(144px,1fr))] gap-2.5">
          {assets.map((asset) => (
            <AssetCard
              asset={asset}
              importing={importingAssetId === String(asset.id)}
              key={asset.id}
              onAdd={() => addAsset(asset)}
            />
          ))}
        </div>
        {loading || hasMoreResults ? (
          <div className="flex h-14 items-center justify-center text-muted-foreground text-sm">
            {loading ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                Loading more
              </>
            ) : (
              "Scroll for more"
            )}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background text-foreground">
      <form
        className="flex shrink-0 items-center gap-2 border-border border-b px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch(1);
        }}
      >
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Search assets"
            autoFocus
            name="asset-search"
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search assets"
            type="search"
            value={term}
          />
        </InputGroup>
        <Button disabled={loading} size="sm" type="submit">
          {loading ? <Loader2Icon className="animate-spin" /> : <SearchIcon />}
          Search
        </Button>
      </form>

      <ScrollArea
        className="min-h-0 flex-1"
        onViewportScroll={handleResultsScroll}
        scrollbarGutter
      >
        <div className="p-3">{resultsContent}</div>
      </ScrollArea>
    </div>
  );
};

const AssetPanelEmpty = ({ children, icon }) => {
  return (
    <div className="grid min-h-80 place-items-center text-center text-muted-foreground text-sm">
      <div className="flex max-w-72 flex-col items-center gap-2">
        <div className="text-foreground">{icon}</div>
        <p className="m-0 text-pretty">{children}</p>
      </div>
    </div>
  );
};

const AssetCard = ({
  asset,
  importing,
  onAdd,
}: {
  asset: Asset;
  importing: boolean;
  onAdd: () => void;
}) => {
  const format = getPreferredAssetFormat(asset);
  const previewUrl = asset.image?.source?.url;
  const canAdd = Boolean(format);
  let title = "Unsupported asset";

  if (canAdd) {
    title = "Add to canvas";
  }

  return (
    <button
      className="group relative min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      disabled={importing || !format}
      onClick={onAdd}
      title={title}
      type="button"
    >
      <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-lg bg-muted/70 outline-1 outline-black/5 -outline-offset-1 group-hover:outline-ring">
        {previewUrl ? (
          <img
            alt=""
            className="h-full w-full object-contain"
            height={160}
            loading="lazy"
            src={previewUrl}
            width={160}
          />
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      {format ? (
        <span className="absolute top-1.5 right-1.5 rounded bg-background/90 px-1.5 py-0.5 font-medium text-[10px] text-foreground uppercase shadow-sm">
          {format}
        </span>
      ) : null}
      <span
        className={cn(
          "absolute inset-x-1.5 bottom-1.5 flex translate-y-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 font-medium text-xs opacity-0 shadow-sm group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 group-disabled:hidden",
          canAdd
            ? "bg-primary text-primary-foreground"
            : "bg-background/92 text-muted-foreground"
        )}
      >
        <PlusIcon className="size-3.5" />
        Add
      </span>
      {importing ? (
        <div className="absolute inset-0 grid place-items-center rounded-lg bg-background/72">
          <Loader2Icon className="size-4 animate-spin" />
        </div>
      ) : null}
    </button>
  );
};
