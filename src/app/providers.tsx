"use client";

import React from "react";
import { SnackbarProvider } from "notistack";

import { getDefaultConfig, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";

export const config = getDefaultConfig({
    appName: "My RainbowKit App",
    projectId: "YOUR_PROJECT_ID",
    chains: [arbitrumSepolia],
    ssr: true, // If your dApp uses server side rendering (SSR)
});

const queryClient = new QueryClient();

const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider>
                    <SnackbarProvider maxSnack={8}>{children}</SnackbarProvider>
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
};

export default Providers;
