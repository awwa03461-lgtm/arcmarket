"use client";

import { useState } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { parseUnits } from "viem";
import { NFT_BYTECODE, NFT_ABI } from "@/lib/nftContract";

// Pinata JWT for uploading image + metadata to IPFS.
// NOTE: visible in the frontend bundle. Fine for testnet; rotate if abused.
const PINATA_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiJiNGY1MWI0Yy0wZDY5LTRmZDItODYyZi00MWQzNmZmODljMDIiLCJlbWFpbCI6Im1pc2VsYm9sYXJAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjYyMjdjNzdmMWUzM2E4ZDJlZTQzIiwic2NvcGVkS2V5U2VjcmV0IjoiYTFiOTliOTVmMjU2YTk2N2M4ZDAwMDg2N2FkYjBmMGFhMmM2MzlmZGJhZjExNWUzYzhiZDU2YWZlZjVjM2EzMCIsImV4cCI6MTgxNDg4NDMyMX0.Q2yDQDEushjAUIkhTT8281FH-VTd75VVU1kbnFo812A";

const EXPLORER = "https://testnet.arcscan.app";

function haptic(t: "success" | "error") {
  (window as any).Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(t);
}

async function pinFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: "Bearer " + PINATA_JWT },
    body: fd,
  });
  if (!r.ok) throw new Error("Image upload failed (" + r.status + ")");
  const j = await r.json();
  return "ipfs://" + j.IpfsHash;
}

async function pinJSON(obj: any): Promise<string> {
  const r = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + PINATA_JWT,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pinataContent: obj }),
  });
  if (!r.ok) throw new Error("Metadata upload failed (" + r.status + ")");
  const j = await r.json();
  return "ipfs://" + j.IpfsHash;
}

export function MintNFT() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [colName, setColName] = useState("");
  const [colSymbol, setColSymbol] = useState("");
  const [nftName, setNftName] = useState("");
  const [nftDesc, setNftDesc] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [deployedAddr, setDeployedAddr] = useState("");

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setPreview(URL.createObjectURL(f));
  }

  const canDeploy =
    isConnected && !!imageFile && colName.trim() && colSymbol.trim() && !busy;

  async function deployAndMint() {
    if (!canDeploy || !walletClient || !publicClient || !address) return;
    setBusy(true);
    setDeployedAddr("");
    try {
      setStatus("Uploading image to IPFS...");
      const imageUri = await pinFile(imageFile!);

      setStatus("Uploading metadata...");
      const metadata = {
        name: nftName.trim() || colName.trim() + " #1",
        description: nftDesc.trim(),
        image: imageUri,
        attributes: [
          { trait_type: "Collection", value: colName.trim() },
          { trait_type: "Network", value: "Arc Testnet" },
        ],
      };
      const tokenUri = await pinJSON(metadata);

      setStatus("Deploying contract... (confirm in wallet)");
      const hash = await walletClient.deployContract({
        abi: NFT_ABI,
        bytecode: NFT_BYTECODE,
        args: [colName.trim(), colSymbol.trim(), 0n, 0n, 0n],
      });

      setStatus("Waiting for deploy confirmation...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const nftAddr = receipt.contractAddress;
      if (!nftAddr) throw new Error("No contract address in receipt");
      setDeployedAddr(nftAddr);

      setStatus("Minting your NFT... (confirm second tx)");
      const mintHash = await walletClient.writeContract({
        address: nftAddr,
        abi: NFT_ABI,
        functionName: "mint",
        args: [tokenUri],
        value: 0n,
      });
      await publicClient.waitForTransactionReceipt({ hash: mintHash });

      setStatus("Done! Your NFT is live on Arc.");
      haptic("success");
    } catch (e: any) {
      haptic("error");
      setStatus("Error: " + (e?.shortMessage || e?.message || "failed"));
    } finally {
      setBusy(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="glass p-6 text-center text-sm" style={{ color: "var(--ink-dim)" }}>
        Connect your wallet to mint an NFT
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <h3 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
        Mint your NFT on Arc
      </h3>
      <p className="mt-1 text-xs" style={{ color: "var(--ink-dim)" }}>
        Upload an image, name it, and deploy your own NFT with one click.
      </p>

      {/* image picker */}
      <label className="mt-4 block">
        <div
          className="glass-2 flex cursor-pointer flex-col items-center justify-center p-6 text-center"
          style={{ border: "1.5px dashed var(--border)" }}
        >
          {preview ? (
            <img src={preview} alt="" className="max-h-48 rounded-xl" />
          ) : (
            <>
              <span className="text-2xl">🖼️</span>
              <span className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>
                Tap to choose an image
              </span>
            </>
          )}
        </div>
        <input type="file" accept="image/*" onChange={onPickImage} className="hidden" />
      </label>

      {/* fields */}
      <div className="mt-4 space-y-3">
        <input
          value={colName}
          onChange={(e) => setColName(e.target.value)}
          placeholder="Collection name (e.g. My Art)"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: "var(--surface-2)", color: "var(--ink)" }}
        />
        <input
          value={colSymbol}
          onChange={(e) => setColSymbol(e.target.value)}
          placeholder="Symbol (e.g. ART)"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: "var(--surface-2)", color: "var(--ink)" }}
        />
        <input
          value={nftName}
          onChange={(e) => setNftName(e.target.value)}
          placeholder="NFT name (optional)"
          className="w-full rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: "var(--surface-2)", color: "var(--ink)" }}
        />
        <textarea
          value={nftDesc}
          onChange={(e) => setNftDesc(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
          className="w-full resize-none rounded-xl px-4 py-3 text-sm outline-none"
          style={{ background: "var(--surface-2)", color: "var(--ink)" }}
        />
      </div>

      <button
        onClick={deployAndMint}
        disabled={!canDeploy}
        className="mt-4 w-full rounded-2xl py-4 font-semibold text-white disabled:opacity-40"
        style={{ background: "var(--usdc)" }}
      >
        {busy ? "Working..." : "Deploy + Mint NFT"}
      </button>

      {status && (
        <div className="mt-3 text-center text-xs" style={{ color: "var(--ink-dim)" }}>
          {status}
        </div>
      )}

      {deployedAddr && (
        <a
          href={EXPLORER + "/address/" + deployedAddr}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block text-center text-xs underline"
          style={{ color: "var(--usdc)" }}
        >
          View your NFT contract on ArcScan
        </a>
      )}

      <p className="mt-3 text-center text-[10px]" style={{ color: "var(--ink-dim)" }}>
        Testnet · Deploys an ERC-721 and mints token #1 to you
      </p>
    </div>
  );
}
