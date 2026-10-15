import { redirect } from 'next/navigation';

// Setups was folded into Playbooks; old links land there.
export default function SetupsPage() {
  redirect('/app/playbooks');
}
