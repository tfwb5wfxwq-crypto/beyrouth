# Configuration Cron Job Supabase - Archivage automatique multi-niveaux

## ✅ Système déployé

Le système d'archivage multi-niveaux est maintenant actif avec :
- **Niveau 1** : Masquage automatique > 30 jours
- **Niveau 2** : Archivage complet > 1 an
- **Niveau 3** : Éligibilité purge > 3 ans

## Configuration du Cron (Dashboard Supabase)

1. **Aller sur le Dashboard Supabase** :
   https://supabase.com/dashboard/project/xbuftfwcyontgqbbrrjt/database/cron-jobs

2. **Créer ou modifier le Cron Job** :
   - **Name** : `Smart archive orders (multi-level)`
   - **Schedule** : `0 3 * * *` (tous les jours à 3h du matin UTC)
   - **Command** :
     ```sql
     SELECT smart_archive_orders();
     ```

Cette fonction exécute automatiquement les 3 niveaux d'archivage et log les résultats.

## Interface Admin

L'onglet **Archives** dans l'admin permet de :

### 📊 Statistiques d'archivage
- **Niveau 1** : Commandes masquées (> 30 jours)
- **Niveau 2** : Commandes archivées (> 1 an)
- **Niveau 3** : Commandes éligibles à la purge (> 3 ans)
- **Taille BDD** : Estimation de l'espace occupé

### ⚙️ Actions disponibles
- **Exécuter archivage maintenant** : Lance `smart_archive_orders()` manuellement
- **Voir logs d'archivage** : Affiche les 20 dernières exécutions
- **Recalculer analytics** : Lance `compute_analytics_batch()` pour les 365 derniers jours

### 🔍 Recherche d'archives
- Recherche par numéro de commande ou email client
- Filtrage par plage de dates
- Limite : 100 résultats max
- Affiche le niveau d'archivage de chaque commande

## Logs d'archivage

Les logs sont automatiquement enregistrés dans la table `archive_logs` :
- Date et heure d'exécution
- Nombre de commandes archivées
- Durée d'exécution

Consultables via l'interface admin ou directement :
```sql
SELECT * FROM archive_logs ORDER BY executed_at DESC LIMIT 20;
```

## Analytics longue durée

La table `order_analytics` stocke les agrégats quotidiens :
- Compteurs (total, complétées, annulées)
- Revenus (total, moyen par commande)
- Moyens de paiement (PayGreen, Edenred)
- Métriques clients (unique, nouveaux, réguliers)

### Calcul manuel des analytics

```sql
-- Pour une journée spécifique
SELECT compute_daily_analytics('2026-03-01');

-- Pour une période (batch)
SELECT compute_analytics_batch('2026-01-01', '2026-03-15');
```

Les analytics sont automatiquement calculées avant l'archivage niveau 2, permettant de purger les vieilles commandes sans perdre les statistiques.

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
