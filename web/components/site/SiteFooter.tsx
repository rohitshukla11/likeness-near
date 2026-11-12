import Link from "next/link";

/** Footer shared by every page. */
export function SiteFooter() {
  return (
    <footer className="on-dark bg-ink text-white">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-12 px-4 pb-9 pt-[72px] sm:px-8">
        <div className="flex flex-wrap justify-between gap-8">
          <h2 className="m-0 font-display text-[clamp(22px,3vw,30px)] font-extrabold leading-[1.3]">
            THE FUTURE OF YOUR
            <br />
            FACE IS YOURS
          </h2>
          <div className="flex flex-col gap-3 text-[15px] text-grey-dark">
            <span className="text-white">License your face to AI. Only you approve each ad.</span>
            <span>Licences, escrow and receipts on NEAR testnet</span>
            <Link href="/how" className="text-grey-dark underline-offset-2 hover:text-white hover:underline">
              How consent works
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-4 border-t border-ink-line pt-6 text-[14px] text-grey-dark">
          <span className="flex flex-wrap gap-6">
            <Link href="/how" className="text-grey-dark hover:text-white">
              How it works
            </Link>
            <Link href="/creators" className="text-grey-dark hover:text-white">
              Creators
            </Link>
            <Link href="/verify" className="text-grey-dark hover:text-white">
              Verify
            </Link>
          </span>
          <span>© 2026 Rohit Shukla · MIT</span>
        </div>
      </div>
    </footer>
  );
}
