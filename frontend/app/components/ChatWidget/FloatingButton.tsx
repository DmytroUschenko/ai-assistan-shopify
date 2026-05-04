import React from "react";
import { Button, Icon } from "@shopify/polaris";
import { ChatIcon } from "@shopify/polaris-icons";

interface FloatingButtonProps {
  onClick: () => void;
}

export function FloatingButton({ onClick }: FloatingButtonProps) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: 9998,
      }}
    >
      <Button
        onClick={onClick}
        variant="primary"
        size="large"
        icon={<Icon source={ChatIcon} />}
        accessibilityLabel="Open AI Assistant"
      />
    </div>
  );
}
