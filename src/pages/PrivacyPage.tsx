import LegalPlaceholderPage from '@/pages/LegalPlaceholderPage';

const PrivacyPage = () => (
  <LegalPlaceholderPage title="Privacy (draft placeholder)">
    <p>This is a pre-launch draft for route review. It has no legal force.</p>
    <p>We collect an uploaded photo so we can generate artwork from it.</p>
    <p>We collect account email and the sign-in provider when someone creates an account.</p>
    <p>Payment data is handled by Stripe. We do not store card numbers in this application.</p>
    <p>We keep generation logs needed to run and deliver the service.</p>
    <p>We do not sell photographs.</p>
    <p>
      We do not use memorial photographs for galleries, ads, or social proof without a separate
      explicit yes.
    </p>
    <p>
      Storage exists so we can generate and deliver the file. This draft does not claim that photos
      stay private always.
    </p>
    <p>
      Deletion contact is a Luke fill-in. No email address is published here because none has been
      approved.
    </p>
    <p>
      Analytics persist funnel events only. Those events do not include photo bytes, file names, or
      personal names.
    </p>
  </LegalPlaceholderPage>
);

export default PrivacyPage;
