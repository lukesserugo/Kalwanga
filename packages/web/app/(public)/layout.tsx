// D:\Projects\Kalwanga\packages\web\app\(public)\layout.tsx

import { RootHeader } from '../../components/layout/RootHeader';
import { RootFooter } from '../../components/layout/RootFooter';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <RootHeader />
      <div className="flex-1">{children}</div>
      <RootFooter />
    </div>
  );
}
