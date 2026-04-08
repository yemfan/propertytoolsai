"use client";

import { useHomeValueEstimate } from "@/lib/home-value/useHomeValueEstimate";
import { AddressAutocompleteInput } from "@/components/home-value/AddressAutocompleteInput";
import { AddressConfirmCard } from "@/components/home-value/AddressConfirmCard";
import { RecentHistory } from "@/components/home-value/RecentHistory";
import { EstimateResultsSection } from "@/components/home-value/EstimateResultsSection";

export default function HomeValuePage() {
  const {
    uiState,
    error,
    unlockError,
    addressInput,
    setAddressInput,
    pendingAddress,
    details,
    setDetails,
    estimateResult,
    unlockResult,
    leadForm,
    setLeadForm,
    prepareAddressSelection,
    confirmSelectedAddress,
    clearPendingAddress,
    startEstimateFromTypedInput,
    runEstimate,
    unlockReport,
    nextActions,
    history,
    restoreFromHistory,
    busyRefine,
  } = useHomeValueEstimate();

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <AddressAutocompleteInput
          value={addressInput}
          onChange={setAddressInput}
          onSelect={prepareAddressSelection}
          onSubmit={() => void startEstimateFromTypedInput()}
          isBusy={busyRefine}
          awaitingAddressConfirm={!!pendingAddress}
        />

        <RecentHistory
          items={history}
          onOpen={(sessionId) => void restoreFromHistory(sessionId)}
        />

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {pendingAddress ? (
          <AddressConfirmCard
            address={pendingAddress}
            onConfirm={() => void confirmSelectedAddress()}
            onEdit={() => {
              clearPendingAddress();
              setAddressInput(pendingAddress.fullAddress);
            }}
            isBusy={busyRefine}
          />
        ) : null}

        <EstimateResultsSection
          uiState={uiState}
          estimateResult={estimateResult}
          unlockResult={unlockResult}
          details={details}
          setDetails={setDetails}
          leadForm={leadForm}
          setLeadForm={setLeadForm}
          nextActions={nextActions}
          onRefreshEstimate={() => void runEstimate(undefined, details)}
          onUnlockReport={() => void unlockReport()}
          unlockError={unlockError}
        />
      </div>
    </div>
  );
}
