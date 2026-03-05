# 📱 Configuration Tablette Kiosque - Beyrouth Express Admin

## 🎯 Objectif
Transformer une tablette Android en terminal dédié pour gérer les commandes Click & Collect de Beyrouth Express.

---

## ✅ Fonctionnalités configurées

### Code (déjà fait)
✅ Service Worker pour PWA
✅ Notifications push natives
✅ Wake Lock (écran toujours allumé)
✅ Mode plein écran automatique
✅ Son + vibration à chaque commande
✅ Permissions auto-demandées au login

### À configurer (sur la tablette)
⏳ Mode Kiosque Android
⏳ Auto-launch au démarrage
⏳ Verrouillage sécurisé

---

## 📋 Instructions de déploiement

### 1. Déployer les fichiers (GitHub Pages)

```bash
cd ~/beyrouth
git add admin/sw.js admin/manifest.json admin/index.html
git commit -m "✨ Mode kiosque tablette admin"
git push
```

**Attendre 2-3 min** que GitHub Pages déploie.

---

## 📲 Configuration de la tablette Android

### 2. Installer la PWA

1. **Ouvrir Chrome** sur la tablette
2. **Aller sur** : `https://beyrouth.express/admin/`
3. **Se connecter** avec le code admin
4. **Autoriser** les notifications quand demandé
5. **Menu Chrome** (⋮) → **"Installer l'application"** ou **"Ajouter à l'écran d'accueil"**
6. L'icône 🧆 **Beyrouth Express - Admin** apparaît sur l'écran d'accueil

### 3. Activer le Mode Kiosque (Android natif)

#### Option A : Kiosque natif (Android 9+)

1. **Paramètres** → **Utilisateurs et comptes**
2. **Ajouter un utilisateur** → **Utilisateur à accès restreint**
3. **Nom** : "Beyrouth Kiosque"
4. **Autoriser UNIQUEMENT** : Beyrouth Express Admin
5. **Basculer** vers ce compte
6. L'appareil ne peut plus sortir de l'app !

**Pour sortir du mode kiosque** :
- Maintenir **Volume Haut + Alimentation** 5 secondes
- Ou : **Paramètres rapides** → **Changer d'utilisateur**

#### Option B : Kiosque avec app dédiée (recommandé)

**App : [Kiosk Browser Lockdown](https://play.google.com/store/apps/details?id=com.procoit.kioskbrowser)**

1. **Installer** Kiosk Browser depuis Play Store
2. **Ouvrir** Kiosk Browser
3. **URL** : `https://beyrouth.express/admin/`
4. **Settings** (⋮) → **Enable Kiosk Mode**
5. **Pin Code** : choisir un code pour sortir du mode
6. **Start on Boot** : ✅ Activer
7. **Prevent Task Switching** : ✅ Activer
8. **Disable Status Bar** : ✅ Activer
9. **Keep Screen On** : ✅ Activer

**Password admin Kiosk Browser** : utiliser un code simple (ex: 1234)

#### Option C : Fully Kiosk Browser (avancé)

**App : [Fully Kiosk Browser](https://play.google.com/store/apps/details?id=de.ozerov.fully)** (version payante recommandée : 7€)

1. **Installer** Fully Kiosk
2. **URL** : `https://beyrouth.express/admin/`
3. **Settings** → **Kiosk Mode**
   - ✅ Enable Kiosk Mode
   - ✅ Start on Boot
   - ✅ Lock Settings
   - ✅ Disable Status Bar
   - ✅ Disable System Bar
   - ✅ Keep Screen On
   - ✅ Prevent Sleep
4. **Remote Admin** : noter IP pour accès à distance
5. **Password** : définir un mot de passe admin

---

### 4. Paramètres Android recommandés

#### Son et Vibrations
1. **Paramètres** → **Son**
2. **Volume notifications** : 🔊 Maximum
3. **Ne pas déranger** : ❌ Désactivé
4. **Vibration** : ✅ Activée

#### Écran
1. **Paramètres** → **Affichage**
2. **Luminosité** : 🔆 75-100%
3. **Mise en veille** : 30 minutes (ou jamais si Kiosk Browser actif)
4. **Rotation automatique** : 🔒 Verrouillée en paysage

#### Batterie
1. **Paramètres** → **Batterie**
2. **Économie d'énergie** : ❌ Désactivée
3. **Optimisation batterie** → **Beyrouth Express Admin** → **Ne pas optimiser**

#### Wi-Fi
1. **Paramètres** → **Wi-Fi**
2. **Se connecter** au réseau du restaurant
3. **Wi-Fi activé en permanence** : ✅ Oui

---

## 🔔 Test des notifications

1. **Ouvrir** l'admin sur la tablette
2. **Depuis un autre appareil** : passer une commande test sur `beyrouth.express`
3. **Vérifier** :
   - ✅ Son joué
   - ✅ Vibration
   - ✅ Notification visible en haut
   - ✅ Commande apparaît dans la liste

---

## 🔒 Sécurité

### Code admin
Le code admin est stocké dans **Supabase** → Table `settings` → Clé `admin_code`

Pour le changer :
```sql
UPDATE settings SET value = 'NOUVEAU_CODE' WHERE key = 'admin_code';
```

### Empêcher les sorties accidentelles

**Si utilisation Kiosk Browser** :
- Les boutons Home/Retour/Multitâche sont bloqués
- Seul le code PIN permet de sortir

**Si mode kiosque natif Android** :
- Impossible de sortir sans mot de passe utilisateur principal

---

## 🆘 Dépannage

### Notifications ne fonctionnent pas
1. **Chrome** → **Paramètres du site** → `beyrouth.express` → **Notifications** : ✅ Autorisées
2. **Android** → **Notifications** → **Beyrouth Express Admin** : ✅ Activées
3. **Recharger** la page (pull to refresh)

### Son ne marche pas
1. **Vérifier** que le volume notifications est à fond
2. **Désactiver** le mode silencieux
3. **Tester** en appuyant sur une commande (le son devrait jouer)

### Mode plein écran se désactive
- C'est normal si on touche la barre de navigation
- Utiliser **Kiosk Browser** pour forcer le plein écran permanent

### L'app ne se lance pas au démarrage
1. **Kiosk Browser** → **Settings** → **Start on Boot** : vérifier activé
2. **Android** → **Applications** → **Kiosk Browser** → **Autorisations** → **Démarrage automatique** : ✅ Autorisé
3. **Redémarrer** la tablette pour tester

---

## 📦 Maintenance

### Mise à jour de l'app
Les mises à jour sont **automatiques** via Service Worker :
- Le Service Worker vérifie les mises à jour toutes les 24h
- Pour forcer : recharger la page (pull to refresh)

### Nettoyer le cache
1. **Ouvrir** Chrome Dev Tools (si accessible)
2. **Application** → **Clear Storage** → **Clear site data**
3. Ou : désinstaller/réinstaller la PWA

---

## ✨ Résultat final

✅ Tablette dédiée 100% admin Beyrouth
✅ Notifications sonores + visuelles instantanées
✅ Impossible de sortir de l'app
✅ Redémarre automatiquement sur l'admin
✅ Écran toujours allumé
✅ Gestion commandes en temps réel

🎉 **La tablette est prête pour le service !**
