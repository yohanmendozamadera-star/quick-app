import { getCurrentUser, can } from "@/lib/permissions";
import {
  getAllCedis,
  getAllCities,
  getAllCoordinators,
  getAllCenlogs,
  getAllTransportTypes,
  getAllChargeDescriptions,
} from "@/lib/catalog/queries";
import { getAllRoles, getAllPermissions, getRolePermissionMap, getAllProfiles } from "@/lib/users/queries";
import { ModulePlaceholder } from "@/components/layout/module-placeholder";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CedisManager } from "@/components/configuraciones/cedis-manager";
import { SimpleCatalogManager } from "@/components/configuraciones/simple-catalog-manager";
import { RolesManager } from "@/components/configuraciones/roles-manager";
import { UsersManager } from "@/components/configuraciones/users-manager";

export default async function ConfiguracionesPage() {
  const user = await getCurrentUser();
  const permissions = user?.permissions ?? [];

  const canManageConfig = can(permissions, "config.manage");
  const canManageUsers = can(permissions, "users.manage");

  if (!user || (!canManageConfig && !canManageUsers)) {
    return (
      <ModulePlaceholder
        title="Configuraciones"
        description="No tienes permiso para ver este módulo."
        denied
      />
    );
  }

  const [cedis, cities, coordinators, cenlogs, transportTypes, chargeDescriptions, roles, allPermissions, rolePermissionMap, profiles] =
    await Promise.all([
      getAllCedis(),
      getAllCities(),
      getAllCoordinators(),
      getAllCenlogs(),
      getAllTransportTypes(),
      getAllChargeDescriptions(),
      canManageUsers ? getAllRoles() : Promise.resolve([]),
      canManageUsers ? getAllPermissions() : Promise.resolve([]),
      canManageUsers ? getRolePermissionMap() : Promise.resolve({}),
      canManageUsers ? getAllProfiles() : Promise.resolve([]),
    ]);

  const defaultTab = canManageConfig ? "droguerias" : "roles";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configuraciones</h1>
        <p className="text-sm text-muted-foreground">
          Administra los catálogos, roles y usuarios que usa la aplicación.
        </p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {canManageConfig && <TabsTrigger value="droguerias">Droguerías</TabsTrigger>}
          {canManageConfig && <TabsTrigger value="ciudades">Ciudades</TabsTrigger>}
          {canManageConfig && <TabsTrigger value="coordinadores">Coordinadores</TabsTrigger>}
          {canManageConfig && <TabsTrigger value="cenlogs">CENLOG</TabsTrigger>}
          {canManageConfig && <TabsTrigger value="transporte">Tipo de transporte</TabsTrigger>}
          {canManageConfig && <TabsTrigger value="cobro">Descripción del cobro</TabsTrigger>}
          {canManageUsers && <TabsTrigger value="roles">Roles</TabsTrigger>}
          {canManageUsers && <TabsTrigger value="usuarios">Usuarios</TabsTrigger>}
        </TabsList>

        {canManageConfig && (
          <>
            <TabsContent value="droguerias" className="pt-4">
              <CedisManager cedis={cedis} cities={cities} />
            </TabsContent>

            <TabsContent value="ciudades" className="pt-4">
              <SimpleCatalogManager table="cities" items={cities} itemLabel="Ciudad" />
            </TabsContent>

            <TabsContent value="coordinadores" className="pt-4">
              <SimpleCatalogManager table="coordinators" items={coordinators} itemLabel="Coordinador" />
            </TabsContent>

            <TabsContent value="cenlogs" className="pt-4">
              <SimpleCatalogManager table="cenlogs" items={cenlogs} itemLabel="CENLOG" />
            </TabsContent>

            <TabsContent value="transporte" className="pt-4">
              <SimpleCatalogManager table="transport_types" items={transportTypes} itemLabel="Tipo de transporte" />
            </TabsContent>

            <TabsContent value="cobro" className="pt-4">
              <SimpleCatalogManager
                table="charge_descriptions"
                items={chargeDescriptions}
                itemLabel="Descripción del cobro"
              />
            </TabsContent>
          </>
        )}

        {canManageUsers && (
          <>
            <TabsContent value="roles" className="pt-4">
              <RolesManager roles={roles} permissions={allPermissions} rolePermissionMap={rolePermissionMap} />
            </TabsContent>

            <TabsContent value="usuarios" className="pt-4">
              <UsersManager profiles={profiles} roles={roles} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
