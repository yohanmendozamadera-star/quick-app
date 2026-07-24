import { ShieldAlert, Construction } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ModulePlaceholder({
  title,
  description,
  denied = false,
}: {
  title: string;
  description: string;
  denied?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          {denied ? (
            <ShieldAlert className="size-5 text-destructive" />
          ) : (
            <Construction className="size-5 text-muted-foreground" />
          )}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
