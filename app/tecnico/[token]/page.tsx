import TechnicianView from "./technician-view";

export default async function TechnicianPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <TechnicianView token={token} />;
}
