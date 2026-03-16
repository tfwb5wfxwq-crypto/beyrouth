# Configuration Cron Job Supabase - Archivage automatique

## Edge Function déployée

✅ `cron-archive-old-orders` : Archive automatiquement les commandes de plus d'1 an

## Configuration du Cron (Dashboard Supabase)

1. **Aller sur le Dashboard Supabase** :
   https://supabase.com/dashboard/project/xbuftfwcyontgqbbrrjt/database/cron-jobs

2. **Créer un nouveau Cron Job** :
   - **Name** : `Archive old orders`
   - **Schedule** : `0 3 * * *` (tous les jours à 3h du matin UTC)
   - **Command** :
     ```sql
     SELECT net.http_post(
       url := 'https://xbuftfwcyontgqbbrrjt.supabase.co/functions/v1/cron-archive-old-orders',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
       )
     );
     ```

3. **Alternative : Appel direct PostgreSQL** (plus simple, pas besoin de Edge Function)
   - **Schedule** : `0 3 * * *`
   - **Command** :
     ```sql
     SELECT archive_old_orders();
     ```

## Format Schedule (cron syntax)

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

**Exemples** :
- `0 3 * * *` : Tous les jours à 3h du matin
- `0 */6 * * *` : Toutes les 6 heures
- `0 0 * * 0` : Tous les dimanches à minuit

## Test manuel

Pour tester l'archivage manuellement :

```sql
-- Via psql ou Supabase SQL Editor
SELECT archive_old_orders();
```

Ou via curl (Edge Function) :
```bash
curl -X POST https://xbuftfwcyontgqbbrrjt.supabase.co/functions/v1/cron-archive-old-orders \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

## Monitoring

Vérifier les logs du cron job :
1. Dashboard Supabase → Database → Cron Jobs
2. Voir "Last run" et "Status"
3. Logs Edge Function : Dashboard → Edge Functions → cron-archive-old-orders → Logs

## Que fait l'archivage ?

- Archive les commandes avec statut `recuperee` ou `cancelled` de plus de **365 jours**
- Met `archived = true` dans la table `orders`
- Ces commandes ne sont plus chargées par l'admin (filtre `archived = false`)
- Les données restent en base pour les analytics/historique
