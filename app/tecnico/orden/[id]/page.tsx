import TechnicianOrderView from "./order-view";

export default async function TechnicianOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TechnicianOrderView orderId={id} />;
}
