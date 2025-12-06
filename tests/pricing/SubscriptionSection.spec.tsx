/**
 * @vitest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SubscriptionSection } from '@/pages/PricingPage';

describe('SubscriptionSection', () => {
  const handleSelect = vi.fn();

  it('does not render when invisible', () => {
    const { container } = render(
      <SubscriptionSection
        isVisible={false}
        currentTier="free"
        loadingTier={null}
        onSelectTier={handleSelect}
      />
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/Wondertone Free/i)).toBeNull();
  });

  it('renders tiers when visible', () => {
    render(
      <SubscriptionSection
        isVisible
        currentTier="free"
        loadingTier={null}
        onSelectTier={handleSelect}
      />
    );

    expect(screen.getByText(/Wondertone Free/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Creator/i).length).toBeGreaterThan(0);
  });
});
