from pathlib import Path
from xml.sax.saxutils import escape
import json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT/'tmp/pdfs'
OUT = ROOT/'output/pdf/olympiade-des-manades-dossier-fonctionnel-illustre.pdf'
FONTS = Path('/Users/tpmge/Library/Fonts')
for name, file in [('Inter','Inter_18pt-Regular.ttf'),('InterB','Inter_18pt-Bold.ttf'),('InterI','Inter_18pt-Italic.ttf'),('Display','PlayfairDisplay-Regular.ttf'),('DisplayB','PlayfairDisplay-Bold.ttf'),('DisplayI','PlayfairDisplay-SemiBoldItalic.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(FONTS/file)))
pdfmetrics.registerFontFamily('Inter',normal='Inter',bold='InterB',italic='InterI',boldItalic='InterB')
W,H=595.276,841.89
M=42
CW=W-2*M
INK='#1c1912'; PAPER='#f7f4ed'; CREAM='#fcfbf7'; MUTED='#5a5246'; LINE='#e3dacb'; ORANGE='#c23b1d'; GOLD='#b78649'; NIGHT='#120e0a'; BLUE='#152027'; GREEN='#2f7a4f'
c=canvas.Canvas(str(OUT),pagesize=(W,H),pageCompression=1)
c.setTitle('Olympiade des manades - Dossier fonctionnel illustré')
c.setAuthor('TPMGE - Projet Olympiade des manades')
c.setSubject('Fonctions, parcours et notations configurables - version du 11 octobre 2026')
c.setCreator('Dossier composé à partir du cahier des charges et de la maquette du projet')
PAGES=[]; CHECKS=[]; PAGE_TITLES={}

def clean(t):
    return str(t).replace('\u2014',' - ').replace('\u2013','-').replace('\u2011','-')

def rect(x,y,w,h,fill=CREAM,stroke=None,r=0):
    c.setFillColor(HexColor(fill))
    c.setStrokeColor(HexColor(stroke or fill))
    if r:c.roundRect(x,H-y-h,w,h,r,stroke=bool(stroke),fill=1)
    else:c.rect(x,H-y-h,w,h,stroke=bool(stroke),fill=1)

def line(x1,y1,x2,y2,color=LINE,width=1):
    c.setStrokeColor(HexColor(color));c.setLineWidth(width);c.line(x1,H-y1,x2,H-y2)

def para(t,x,y,w,size=10.4,color=INK,font='Inter',leading=None):
    sty=ParagraphStyle('p',fontName=font,fontSize=size,leading=leading or size*1.43,textColor=HexColor(color),spaceAfter=0,allowWidows=0,allowOrphans=0)
    p=Paragraph(clean(t),sty);ww,hh=p.wrap(w,H)
    p.drawOn(c,x,H-y-hh)
    CHECKS.append({'page':c.getPageNumber(),'x':round(x,2),'y':round(y,2),'w':round(w,2),'h':round(hh,2),'text':t[:95]})
    assert y >= 800 or y+hh < 789, (c.getPageNumber(),t[:90],y+hh)
    return y+hh

def tag(t,x,y,color=ORANGE):
    return para(t.upper(),x,y,CW,8.1,color,'InterB',11)

def title(kicker,t,sub=None):
    PAGE_TITLES[c.getPageNumber()]=clean(t.replace('<br/>',' '))
    tag(kicker,M,44)
    bottom=para(t,M,65,CW,29,INK,'DisplayB',34)
    if sub:bottom=para(sub,M,bottom+12,CW,10.2,MUTED,leading=14.5)
    line(M,bottom+17,W-M,bottom+17)
    return bottom+36

def bullet(t,x,y,w,size=10.3):
    rect(x,y+6,4,4,ORANGE,r=1)
    return para(t,x+13,y,w-13,size)+10

def bullets(items,x,y,w,size=10.3):
    for t in items:y=bullet(t,x,y,w,size)
    return y

def card(label,body,x,y,w,h=None,fill=CREAM,accent=ORANGE):
    st=ParagraphStyle('m',fontName='Inter',fontSize=10.1,leading=14.5)
    bp=Paragraph(clean(body),st);_,bh=bp.wrap(w-30,H)
    height=h or bh+56
    rect(x,y,w,height,fill,LINE,10)
    rect(x+15,y+17,3,16,accent,r=1)
    para(label,x+26,y+14,w-41,13.1,INK,'InterB',17)
    para(body,x+15,y+43,w-30,10.1,MUTED,leading=14.5)
    return y+height

def callout(label,body,y,fill=BLUE):
    st=ParagraphStyle('n',fontName='Inter',fontSize=10.2,leading=14.5)
    _,bh=Paragraph(clean(body),st).wrap(CW-32,H)
    height=bh+49
    rect(M,y,CW,height,fill,r=9)
    para(label,M+16,y+12,CW-32,11,'#e2c08a','InterB',15)
    para(body,M+16,y+34,CW-32,10.2,'#f6efe4',leading=14.5)
    return y+height

def screen(name,x,y,w,h=None):
    path=WORK/'screens'/f'{name}.png'
    iw,ih=Image.open(path).size
    if h is None:h=w*ih/iw
    else:w=min(w,h*iw/ih);h=w*ih/iw
    c.drawImage(ImageReader(str(path)),x,H-y-h,width=w,height=h,mask='auto')
    return y+h

def caption(t,y,x=M,w=CW):
    return para(t,x,y,w,8.2,MUTED,leading=11.4)

def table(headers,rows,y,widths=None,size=9.5):
    widths=widths or [CW/len(headers)]*len(headers)
    x=M; hh=30
    rect(M,y,CW,hh,BLUE,r=5)
    for head,w in zip(headers,widths):para(head,x+10,y+8,w-20,9.1,'#f6efe4','InterB',12);x+=w
    y+=hh
    for n,row in enumerate(rows):
        heights=[]
        for cell,w in zip(row,widths):
            p=Paragraph(clean(cell),ParagraphStyle('t',fontName='Inter',fontSize=size,leading=size*1.4))
            heights.append(p.wrap(w-20,H)[1])
        rh=max(heights)+19
        rect(M,y,CW,rh,CREAM if n%2==0 else '#efe7d8')
        x=M
        for cell,w in zip(row,widths):para(cell,x+10,y+9,w-20,size,INK,leading=size*1.4);x+=w
        y+=rh
    return y

def arrow(x1,y1,x2,y2,col=GOLD):
    line(x1,y1,x2,y2,col,1.7)
    import math
    a=math.atan2(y2-y1,x2-x1)
    for d in [-.5,.5]:line(x2,y2,x2-6*math.cos(a+d),y2-6*math.sin(a+d),col,1.7)

def steps(items,y):
    w=(CW-14*(len(items)-1))/len(items)
    for i,(head,body) in enumerate(items):
        x=M+i*(w+14)
        rect(x,y,w,97,CREAM,LINE,8)
        para(f'{i+1:02}',x+12,y+10,w-24,20,ORANGE,'DisplayI',23)
        para(head,x+12,y+39,w-24,10.5,INK,'InterB',14)
        para(body,x+12,y+59,w-24,8.8,MUTED,leading=12)
        if i<len(items)-1:arrow(x+w+2,y+48,x+w+12,y+48)
    return y+97

def page(fn):PAGES.append(fn);return fn

@page
def cover():
    rect(0,0,W,H,NIGHT)
    img=ROOT/'docs/maquette/img/arenes.webp'
    c.drawImage(ImageReader(str(img)),0,H-420,width=W,height=420,mask='auto')
    c.saveState();c.setFillColor(HexColor(NIGHT));c.setFillAlpha(.60);c.rect(0,H-420,W,420,fill=1,stroke=0);c.restoreState()
    tag('DOSSIER FONCTIONNEL ILLUSTRÉ',M,46,'#e2c08a')
    para('Olympiade<br/>des manades',M,105,CW,48,'#fcfbf7','DisplayB',55)
    para('Vivre la soirée.<br/>Noter les prestations.<br/>Partager les résultats.',M,255,400,19,'#fcfbf7','Inter',27)
    rect(M,451,54,4,ORANGE)
    para('Toutes les fonctions,<br/>du premier QR code au palmarès.',M,480,CW,28,'#f7f4ed','Display',35)
    para('Site public • Spectateurs • Jury • Organisation • Écran géant',M,580,CW,11,'#e2c08a',leading=16)
    para('Parcours illustrés, règles de notation, administration, import du planning, notifications et préparation d’une soirée réelle.',M,622,CW-24,12,'#b5a690',leading=18)
    line(M,707,W-M,707,'#504235')
    para('11 OCTOBRE 2026  /  VERSION 1.0',M,727,CW,9,'#e2c08a','InterB')
    para('Conception : TPMGE • Identité du projet avec Atch Élevage',M,749,CW,9,'#b5a690')

@page
def contents():
    y=title('Lecture du dossier','Un projet, cinq usages','Le périmètre complet, avec les réglages de la première version et les possibilités conservées pour la suite.')
    rows=[('01','Comprendre le service','03'),('02','Site, inscription et vote public','04 - 08'),('03','Jury et toutes les notations','09 - 13'),('04','Préparer et piloter une soirée','14 - 18'),('05','Notifications, avis et accès','19 - 22'),('06','Fonctionnement, recette et livraison','23 - 26'),('07','Sources et crédits','27')]
    for num,head,pg in rows:
        target=int(pg.split(' - ')[0])
        c.linkRect('',f'p{target}',(M,H-y-30,W-M,H-y+4),relative=0,thickness=0)
        para(num,M,y,30,14,ORANGE,'DisplayI');para(head,M+42,y,375,11.2,INK,'InterB');para(pg,W-M-52,y,52,10.5,MUTED)
        line(M,y+29,W-M,y+29);y+=44
    y+=13
    card('V1 prévue','Fonctions détaillées dans le cahier des charges v0.8 : public sur 10, jury sur 10 ou 20, deux modes d’ouverture et trois modes de classement.',M,y,CW)
    y+=116
    card('Options conservées','Critères personnalisés, autres échelles, mesures, préférences et essais multiples restent dans le périmètre de conception. Leur présence ici ne signifie pas qu’elles sont déjà développées.',M,y,CW)
    caption('Base documentaire arrêtée au 11/10/2026. Les maquettes montrent des données simulées. Ce dossier décrit le produit et ses objectifs ; il ne certifie ni un règlement sportif commun ni l’état du service en production.',746)

@page
def roles():
    y=title('01 / Vue d’ensemble','Le même événement,<br/>des accès adaptés','Chacun voit les actions utiles à son rôle. Les autorisations doivent être contrôlées côté serveur.')
    items=[('Visiteur','Consulter les dates, les photos, les palmarès et le contact. Aucun compte nécessaire.'),('Spectateur','Valider son email, noter les passages ouverts, suivre les résultats et donner son avis sur la soirée.'),('Juge','Accéder à sa soirée, saisir ses notes et commentaires privés, corriger avant verrouillage.'),('Organisateur','Préparer les données, piloter les votes, suivre les juges et publier le classement final.'),('Écran géant','Diffuser le QR code, la manade en piste et les résultats autorisés. Lecture seule.')]
    for i,(head,body) in enumerate(items):
        rect(M,y,42,65,ORANGE if i==3 else BLUE,r=8);para(f'{i+1:02}',M+9,y+17,29,20,'#fffaf0','DisplayI')
        para(head,M+59,y+3,CW-59,14,INK,'InterB');para(body,M+59,y+26,CW-59,10.4,MUTED)
        y+=88
    callout('Une soirée comme fil conducteur','Préparer → publier → ouvrir les passages → collecter les notes → contrôler → révéler et archiver.',y+2)

@page
def vitrine():
    y=title('02 / Site vitrine','Découvrir, puis participer','Une entrée simple sur téléphone, avec « Notez les Olympiades » visible dès l’arrivée.')
    end=screen('accueil',M,y,CW)
    caption('Accueil de la maquette validée. Date, soirée et informations affichées : démonstration.',end+8)
    y=end+38
    y=bullets(['<b>Accueil :</b> accès au vote, prochaine soirée, compte à rebours, photos, présentation des épreuves et dernier vainqueur.', '<b>Hors soirée :</b> bouton visible mais indisponible, avec la raison et le prochain rendez-vous.', '<b>Navigation :</b> Classements, Dates, Contact, mentions légales et confidentialité.', '<b>Contenus :</b> textes, images, dates et palmarès modifiables par l’admin ; photos créditées et optimisées.'],M,y,CW)
    caption('Les repères de manades de la maquette sont provisoires. Les vrais logos et fers sont intégrés à partir des fichiers validés par leurs propriétaires.',y+5)

@page
def archives():
    y=title('02 / Calendrier et archives','Retrouver une soirée<br/>et son palmarès','Un calendrier à jour et des résultats dont la provenance reste visible.')
    end=screen('dates',M,y,CW)
    caption('Maquette du calendrier. Les dates de démonstration ne constituent pas une programmation confirmée.',end+6)
    y=end+35
    y=table(['Calendrier','Palmarès'],[
        ('Date, heure, ville, arènes et lien vers la billetterie externe.','Année, événement, rang, manade et vainqueurs par épreuve.'),
        ('Statut explicite : prévisionnelle, confirmée, reportée ou annulée.','Source et statut : confirmé ou à confirmer. Aucun score inventé.'),
        ('Dates 2027 et archives des années précédentes.','Onglets 2025, 2026 et 2027. Reprise manuelle des résultats antérieurs à l’app.'),
    ],y,[CW/2,CW/2],9.4)
    caption('Les classements des éditions gérées dans l’app seront alimentés par ses résultats. La billetterie et le paiement ne font pas partie de la V1.',y+12)

@page
def signup():
    y=title('02 / Accès au vote','S’inscrire une fois,<br/>retrouver la saison','Le public entre par un QR code ou un lien et confirme son adresse email.')
    end1=screen('inscription',M+19,y,193)
    end2=screen('code',M+299,y,193)
    arrow(M+225,y+185,M+285,y+185)
    y=max(end1,end2)+12
    caption('Deux étapes de la maquette : identité puis code email. Informations personnelles fictives.',y)
    y+=35
    bullets(['<b>Prénom et email</b>, information sur l’utilisation des données et validation du code à 6 chiffres. Un lien email sert de secours.', '<b>Session conservée</b> sur le téléphone ; nouvelle authentification si elle expire ou si l’utilisateur se déconnecte.', '<b>Inscription en amont</b> encouragée. Activation des notifications proposée ensuite, sans être nécessaire pour voter.'],M,y,CW,10)

@page
def public_vote():
    y=title('02 / Notation du public','Une manade, un passage,<br/>une note','La V1 prévoit une note de 1 à 10, facile à saisir d’une main.')
    end=screen('vote',M,y,226)
    x=M+249;ww=CW-249
    yy=bullets(['<b>Contexte lisible :</b> épreuve, manade et état du passage.', '<b>Dix boutons :</b> la note choisie est mise en évidence.', '<b>Confirmation :</b> distinguer « envoi », « enregistré » et « en attente réseau ».', '<b>Correction possible</b> tant que le passage est ouvert. La nouvelle note remplace la précédente.', '<b>Une seule note active</b> par compte vérifié et par passage.'],x,y+8,ww,10.1)
    card('Un vote personnel','Le spectateur consulte ses propres notes et les résultats agrégés. Il ne voit pas les votes individuels des autres.',x,yy+5,ww)
    caption('Maquette V1, données simulées. Les boutons affichent une échelle de 1 à 10 ; les autres formats sont décrits page 10.',max(end,yy+147)+12)

@page
def modes():
    y=title('02 / Ouverture des votes','Deux façons de rythmer<br/>la soirée','L’organisateur choisit le mode de vote pour chaque édition.')
    y=card('Mode libre','Tous les passages notés sont accessibles pendant la fenêtre de la soirée. Le public peut les noter dans l’ordre de son choix. L’admin peut avancer l’ouverture, fermer ou prolonger la fenêtre.',M,y,CW)
    y+=18
    y=steps([('Ouverture','Début autorisé'),('Votes libres','Tous les passages'),('Fermeture','Fin côté serveur')],y)
    y+=27
    y=card('Mode par déblocage','L’admin ouvre une épreuve entière ou une manade à la fois, puis ferme les passages. Plusieurs passages peuvent rester ouverts simultanément.',M,y,CW)
    y+=18
    y=steps([('À venir','Vote indisponible'),('Débloqué','Note modifiable'),('Fermé','Vote refusé')],y)
    callout('Le serveur décide de la recevabilité','Une note envoyée après la fermeture n’est pas comptée, même si elle avait été préparée sur le téléphone avant la coupure du réseau.',y+24)

@page
def jury():
    y=title('03 / Jury','Noter avec précision','Un accès personnel à la soirée et une interface différente de celle du public.')
    end=screen('jury',M,y,CW)
    caption('Espace jury de la maquette, sur tablette. Les noms, notes et commentaires sont fictifs.',end+7)
    y=end+38
    bullets(['<b>Accès :</b> lien personnel ou QR code créé par l’admin, limité aux soirées attribuées.', '<b>V1 :</b> barème sur 10 ou sur 20, saisie au demi-point et commentaire privé facultatif.', '<b>Ouverture indépendante :</b> les passages jury suivent le public par défaut, mais l’admin peut laisser les juges finaliser ensuite.', '<b>Suivi :</b> notes manquantes visibles pour l’organisateur, correction tant que le jury est ouvert, puis verrouillage.', '<b>Option d’ergonomie :</b> grille manades × épreuves et saisie au clavier sur ordinateur.'],M,y,CW,10)

@page
def all_scoring():
    y=title('03 / Catalogue de notation','Conserver toutes<br/>les possibilités','La V1 pose un socle simple. Les autres formats restent des options de conception, à activer selon le règlement de l’édition.')
    y=table(['Mode','Réglages prévus','Positionnement'],[
        ('Note globale','Échelle, bornes, pas et décimales.','V1 : public /10 ; jury /10 ou /20.'),
        ('Critères','Nom, explication, niveaux, maximum et coefficient.','Option conservée ; grille à définir.'),
        ('Points','Total saisi ou points attribués à des éléments du barème.','Option conservée.'),
        ('Places','Rang et conversion en points ; ex æquo explicites.','V1 : points par place ; règles à préciser.'),
        ('Mesures','Réussite, décompte ou durée ; unité et sens du classement.','Option non confirmée dans les sources étudiées.'),
        ('Vote public alternatif','Étoiles, favori ou préférences classées.','Option conservée en complément du /10.'),
        ('Appréciation et prix','Commentaire sans score, prix spécial, démonstration.','Prix et démonstrations ; aucun score forcé.'),
        ('Avis sur la soirée','1 à 5 étoiles et commentaire privé.','V1 ; distinct des performances.'),
    ],y,[106,245,CW-351],9.4)
    callout('Aucune grille officielle préremplie','Un exemple sur 20 est documenté, mais les critères et leurs points ne sont pas connus. Chaque modèle doit porter une origine : démonstration, proposition ou règlement validé pour l’édition.',y+21)

@page
def criteria():
    y=title('03 / Critères personnalisés','Une grille explicable<br/>avant la première note','Exemple de configuration à discuter avec un organisateur. Ces critères ne sont pas un règlement retrouvé.')
    tag('EXEMPLE FICTIF / OPTION CONSERVÉE',M,y)
    y+=24
    y=table(['Critère proposé','Note saisie','Poids'],[
        ('Maîtrise<br/><font size="8">Décrire les niveaux attendus.</font>','8 / 10','50 %'),
        ('Précision<br/><font size="8">Définir les gestes observables.</font>','7 / 10','30 %'),
        ('Coordination<br/><font size="8">Préciser l’évaluation collective.</font>','9 / 10','20 %'),
    ],y,[300,110,CW-410],10)
    y+=24
    rect(M,y,CW,94,BLUE,r=10)
    para('8 × 50 % + 7 × 30 % + 9 × 20 %',M+19,y+16,CW-38,16,'#f7f4ed','Inter',22)
    para('7,9 / 10',M+19,y+47,CW-38,27,'#e2c08a','DisplayI',32)
    y+=118
    y=bullets(['<b>Pour chaque critère :</b> intitulé, consigne, caractère obligatoire, bornes, pas et coefficient.', '<b>Critères sur des échelles différentes :</b> conversion explicite vers une même échelle avant pondération.', '<b>Avant ouverture :</b> prévisualiser un cas de calcul et valider le modèle de l’édition.', '<b>Après ouverture :</b> conserver la version utilisée. Toute correction du barème doit être tracée, recalculée et revalidée.', '<b>Essais multiples :</b> nombre autorisé et résultat retenu - meilleur essai, somme ou moyenne.', '<b>Bonus et pénalités :</b> motif, valeur, unité et étape d’application ; préciser si le score peut dépasser les bornes.'],M,y,CW,10.2)
    caption('Le catalogue des épreuves ne crée pas automatiquement ces critères. Les exemples « maîtrise », « précision » et « coordination » restent modifiables et facultatifs.',y+5)

@page
def general_calc():
    y=title('03 / Classement général','Deux méthodes<br/>à rendre visibles','Le nom de la méthode doit accompagner le résultat. Les calculs ci-dessous sont pédagogiques.')
    y=card('1. Moyenne des notes','Chaque épreuve compte selon le coefficient retenu. Exemple avec des coefficients égaux : (8 + 9 + 7 + 8) / 4 = <b>8 / 10</b>. Une note absente n’est jamais transformée en zéro.',M,y,CW)
    y+=23
    para('2. Cumul de points par place',M,y,CW,17,INK,'DisplayB',22);y+=34
    para('Exemple à 4 manades : 1er = 4 points, 2e = 3, 3e = 2 et 4e = 1. La régularité peut l’emporter.',M,y,CW,10.2,MUTED);y+=49
    y=table(['Équipe fictive','Ép. 1','Ép. 2','Ép. 3','Ép. 4','Total'],[
        ('A - 2e partout','3','3','3','3','12'),
        ('B - 2 victoires','4','1','4','1','10'),
        ('C - 2 victoires','1','4','1','4','10'),
        ('D - 3e partout','2','2','2','2','8'),
    ],y,[166,62,62,62,62,CW-414],10)
    y+=24
    y=callout('Un exemple, pas une reconstitution d’Alès','Les comptes rendus montrent qu’un vainqueur général peut n’avoir gagné aucune épreuve. Ils ne donnent pas la formule complète utilisée. La table ci-dessus illustre une possibilité de l’app.',y)
    caption('À fixer avant usage : attribution des points aux ex æquo, nombre de manades pris en compte, épreuves annulées, coefficients et règle de classement si des notes manquent.',y+18)

@page
def combined():
    y=title('03 / Jury et public','Séparés ou combinés,<br/>toujours compréhensibles','Trois modes de résultat sont prévus : deux classements, combiné pondéré, ou jury seul officiel.')
    gap=15;ww=(CW-gap)/2
    card('Jury','Exemple : <b>17 / 20</b><br/>Conversion de la V1 : <b>8,5 / 10</b>',M,y,ww,111,CREAM)
    card('Public','Exemple : moyenne <b>8 / 10</b><br/>Nombre de votes affiché.',M+ww+gap,y,ww,111)
    y+=133
    rect(M,y,CW,87,BLUE,r=10)
    para('Exemple : jury 70 % + public 30 %',M+17,y+14,CW-34,11,'#f6efe4','InterB')
    para('8,5 × 0,70 + 8 × 0,30 = 8,35 / 10',M+17,y+43,CW-34,19,'#e2c08a','DisplayI',25)
    y+=112
    y=bullets(['<b>Poids configurable :</b> le 70/30 du prototype est un exemple produit, pas un barème officiel trouvé.', '<b>Traçabilité :</b> conserver les composantes jury et public ; ne pas mélanger les avis sur la soirée.', '<b>Visibilité :</b> afficher le classement en direct ou le masquer jusqu’à la révélation.', '<b>Égalités :</b> même rang dans la V1. Tout départage supplémentaire doit être annoncé.', '<b>Données incomplètes :</b> résultat provisoire. Ne pas réaffecter silencieusement le poids d’une composante manquante.'],M,y,CW,10.2)
    caption('La division par deux concerne ici la conversion V1 de /20 vers /10. Une autre échelle exigera une conversion définie dans son propre barème. Seuil de votes et arrondis restent à paramétrer.',y+5)

@page
def preparation():
    y=title('04 / Préparation','Créer une soirée<br/>sans repartir de zéro','L’organisateur réutilise l’annuaire, les modèles d’épreuves et les réglages d’une édition précédente.')
    y=steps([('Créer','Ou dupliquer'),('Préparer','Données et règles'),('Publier','Après contrôle')],y)
    y+=26
    y=table(['Bloc','Fonctions'],[
        ('Identité de la soirée','Nom, date, heure, arènes, ville, fenêtre de vote, message public.'),
        ('Manades et équipes','Annuaire réutilisable, ville et logo ; inscriptions et ordre des passages. Composition des équipes et gardians : extension conservée.'),
        ('Programme','Importer, choisir un modèle ou saisir à la main ; ajouter, réordonner et modifier les épreuves.'),
        ('Passages','Une manade dans une épreuve ; statut public et statut jury. Démonstrations visibles mais non notées.'),
        ('Accès et règles','Juges attribués, modes de vote, barèmes, classements et visibilité. QR code partageable et affiche PDF.'),
    ],y,[125,CW-125],9.6)
    y+=22
    callout('Cycle de vie','Brouillon → publiée → en cours → terminée.<br/>Une soirée peut aussi être reportée ou annulée, avec un message explicite pour le public.',y)

@page
def importing():
    y=title('04 / Import du planning','Du document au planning,<br/>avec une revue humaine','PDF, photo, Word ou tableur : l’IA prépare un brouillon que l’admin corrige et valide.')
    end=screen('import',M,y,CW)
    caption('Écran de revue de la maquette. L’application du brouillon est une action explicite.',end+6)
    y=end+34
    y=bullets(['<b>Formats prévus :</b> PDF, JPG, PNG, WebP, HEIC converti, DOCX, XLSX, XLS et CSV ; limite prévue de 20 Mo.', '<b>Extraction :</b> nom, date, lieu, horaires, manades et épreuves ; rapprochement avec l’annuaire.', '<b>Contrôle :</b> horaires absents, doublons, lignes illisibles et nouvelles manades signalés. Descriptions proposées par l’IA identifiées.', '<b>Validation :</b> tableau modifiable, puis « Appliquer au planning ». Aucun remplacement silencieux du planning publié.', '<b>Historique :</b> fichier d’origine, résultat, auteur, date et erreurs. Saisie manuelle disponible en secours.'],M,y,CW,9.7)

@page
def live_admin():
    y=title('04 / Organisation en direct','Piloter depuis le bord<br/>de la piste','Une action principale : ouvrir ou fermer les votes au bon moment.')
    end=screen('cockpit',M,y,CW)
    caption('Cockpit de démonstration sur ordinateur. La version téléphone reprend les mêmes actions.',end+6)
    y=end+35
    bullets(['<b>Débloquer :</b> toute une épreuve ou une seule manade ; fermer les passages concernés.', '<b>Suivre :</b> compteurs de votes, inscriptions, progression et juges n’ayant pas encore noté.', '<b>Adapter :</b> passer à l’épreuve suivante, décaler la suite de +N minutes, dissocier le jury du public.', '<b>Publier :</b> masquer ou révéler le classement, verrouiller les notes et terminer la soirée.', '<b>Confirmer :</b> les actions définitives ou sensibles demandent une confirmation claire.'],M,y,CW,10)

@page
def results():
    y=title('04 / Résultats','Contrôler avant<br/>la remise des prix','Chaque total doit être explicable à partir des notes et des règles de la soirée.')
    end=screen('resultats',M,y,CW)
    caption('Maquette des résultats : choix de la méthode, pondération et visibilité. Valeurs fictives.',end+6)
    y=end+34
    y=table(['Avant publication','Après validation'],[
        ('Vérifier les notes attendues et les passages encore ouverts.','Verrouiller le jury et identifier le classement comme final.'),
        ('Consulter le détail par épreuve, les composantes et les vainqueurs.','Révéler au public et sur l’écran géant selon le mode retenu.'),
        ('Résoudre les erreurs et tracer les corrections.','Exporter CSV et PDF avec règles, date et état des résultats.'),
    ],y,[CW/2,CW/2],9.4)
    caption('Les champs de traçabilité dans les exports font partie des compléments à prévoir. Une correction après publication doit conserver l’ancienne version et entraîner une nouvelle validation.',y+12)

@page
def giant_screen():
    y=title('04 / Écran géant','Faire participer<br/>toutes les tribunes','Un affichage en lecture seule, pensé pour les arènes et le vidéoprojecteur.')
    end=screen('ecran',M,y,CW)
    caption('Écran 16:9 de la maquette. QR code, adresse et date : démonstration, pas un accès de vote à diffuser.',end+9)
    y=end+49
    y=bullets(['<b>QR code permanent</b> vers la soirée, accompagné d’une adresse lisible.', '<b>Contexte en cours :</b> épreuve, manade en piste et invitation à voter quand le passage est ouvert.', '<b>Classement autorisé :</b> suit le choix de l’organisateur ; message d’attente si les résultats sont masqués.', '<b>Affichage autonome :</b> plein écran et actualisation automatique, sans accès aux commandes admin.', '<b>Recette sur place :</b> vérifier lisibilité à distance, contraste, réseau et scan du QR code.'],M,y,CW,10.3)

@page
def notifications():
    y=title('05 / Notifications et réseau','Informer sans perdre<br/>la confiance du votant','Les états affichés doivent refléter ce qui a réellement été reçu par le serveur.')
    y=steps([('Déblocage','Décision de l’admin'),('Notification','Lien vers le passage'),('Vote reçu','Confirmation serveur')],y)
    y+=25
    y=table(['Situation','Comportement prévu'],[
        ('Notifications autorisées','Prévenir à l’ouverture, au déblocage et à la révélation du classement ; accès direct au bon écran.'),
        ('Plusieurs déblocages','Regrouper les notifications rapprochées. Aucune notification hors des soirées ; désactivation dans les réglages.'),
        ('App déjà ouverte','Bannière de secours ; vibration si le navigateur et le téléphone la permettent.'),
        ('Connexion perdue','Conserver la note localement et afficher « en attente d’envoi ». Ne pas annoncer « enregistré ».'),
        ('Réseau de retour','Envoyer la note ; le serveur vérifie à nouveau que le passage est ouvert.'),
        ('Vote fermé entre-temps','Afficher « Vote fermé, note non prise en compte ». Le classement ne doit pas l’inclure.'),
    ],y,[143,CW-143],9.5)
    callout('Objectifs à vérifier sur de vrais téléphones','Déblocage visible en moins de 10 s ; notification visée en moins de 15 s. La livraison dépend du réseau, du système et de l’autorisation donnée par l’utilisateur.',y+24)

@page
def feedback():
    y=title('05 / Avis et contact','Écouter les spectateurs','Les retours sur la soirée servent à l’organisation et ne changent jamais les notes des manades.')
    end=screen('avis',M,y,214)
    x=M+239;ww=CW-239
    yy=card('Avis après la soirée','1 à 5 étoiles, un commentaire facultatif de 500 caractères et un seul avis par spectateur et par soirée.',x,y,ww)
    yy=card('Lecture privée','Les admins voient la moyenne, le nombre d’avis et les commentaires. Aucun fil de commentaires public en V1.',x,yy+16,ww)
    yy=card('Formulaire de contact','Prénom, email et message ; protection anti-robot, enregistrement puis transmission à l’organisateur. Suivi du traitement côté admin.',x,yy+16,ww)
    caption('Bas de l’écran de classement de la maquette. La collecte réelle des avis doit respecter la fermeture de la soirée.',max(end,yy)+15)

@page
def admin_data():
    y=title('05 / Données et droits','Une administration<br/>qui garde la trace','Les données publiques, les notes personnelles et les commandes de l’organisateur ont des accès différents.')
    y=table(['Donnée ou action','Visiteur / public','Juge','Admin'],[
        ('Dates, photos, palmarès','Consulter','Consulter','Gérer'),
        ('Note du public','Sa propre note','Selon accès public','Suivre les résultats'),
        ('Note jury','Pas d’écriture','Ses soirées et notes','Suivre, verrouiller'),
        ('Planning et passages','Consulter','Consulter','Modifier, ouvrir, fermer'),
        ('Commentaires jury','Non','Les siens','Lire'),
        ('Avis sur la soirée','Son avis','Selon accès public','Lire les retours'),
        ('Contact','Envoyer','Envoyer','Consulter et traiter'),
        ('Imports du planning','Non','Non','Importer et valider'),
    ],y,[149,142,99,CW-390],9)
    y+=25
    y=bullets(['<b>Protection des accès :</b> rôles vérifiés côté serveur, notes publiques limitées à leur auteur, juges rattachés aux bonnes soirées.', '<b>Historique :</b> conserver sources, versions du barème, validations et corrections. Une édition garde ses propres participants.', '<b>Compte :</b> prévoir suppression depuis l’app, gestion des notifications et durée de conservation documentée.', '<b>Informations :</b> mentions légales, confidentialité, crédits photo et coordonnées de l’organisateur accessibles.'],M,y,CW,10)
    caption('La politique de conservation, le traitement des résultats après suppression d’un compte et les textes de confidentialité doivent être finalisés avant l’ouverture au public.',y+4)

@page
def channels():
    y=title('05 / Supports et identité','Le téléphone d’abord,<br/>les autres écrans aussi','Une identité cohérente, avec trois ambiances pour reconnaître immédiatement son espace.')
    ww=(CW-24)/3
    for i,(name,col,fg,body) in enumerate([('Jour',PAPER,INK,'Site et organisation'),('Nuit',NIGHT,'#f6efe4','Public en direct'),('Étang',BLUE,'#e2c08a','Jury')]):
        x=M+i*(ww+12);rect(x,y,ww,112,col,LINE,9);para(name,x+14,y+17,ww-28,21,fg,'DisplayB');para(body,x+14,y+61,ww-28,10,fg)
    y+=138
    y=table(['Support','Usage prévu'],[
        ('Web mobile','Accès principal du public, sans installation. Site installable sur l’écran d’accueil.'),
        ('Android','Application destinée d’abord aux admins et juges ; accès public activable par l’organisateur.'),
        ('iPhone','Site web en V1. Sur les versions compatibles, ajout à l’écran d’accueil nécessaire pour les notifications web ; guide prévu.'),
        ('Tablette et ordinateur','Organisation, revue du planning, suivi du jury et résultats ; interfaces adaptées à la largeur.'),
        ('Écran géant','Vue 16:9, lecture seule, lisible à distance.'),
    ],y,[135,CW-135],9.7)
    y+=25
    y=bullets(['<b>Accessibilité :</b> contrastes visés AA, navigation clavier, focus visible, animations réduites sur demande et états expliqués par du texte.', '<b>Gestes :</b> cibles de 48 px minimum ; notes publiques de 52 px ; commandes principales du jury de 72 px.', '<b>Identité :</b> Inter, Playfair Display, titre manuscrit court, palette sable et couchant, signatures Atch Élevage et TPMGE.'],M,y,CW,10)

@page
def architecture():
    y=title('06 / Fonctionnement','Une donnée fiable,<br/>plusieurs interfaces','Vue de principe pour comprendre où sont appliquées les règles, sans figer les versions des outils.')
    ww=(CW-24)/3
    for i,lab in enumerate(['Web public','Jury et admin','Écran géant']):
        x=M+i*(ww+12);rect(x,y,ww,61,CREAM,LINE,8);para(lab,x+12,y+20,ww-24,12,INK,'InterB')
        arrow(x+ww/2,y+67,W/2,y+111)
    y+=119
    rect(M+41,y,CW-82,89,BLUE,r=10)
    para('Serveur et base de données',M+57,y+15,CW-114,17,'#f6efe4','DisplayB')
    para('Accès • fenêtres de vote • unicité • calculs • historique',M+57,y+49,CW-114,9.5,'#e2c08a')
    y+=112
    
    for i,(head,body) in enumerate([('Emails','Codes et contact'),('Imports','Fichiers et analyse'),('Notifications','Web et Android')]):
        x=M+i*(ww+12)
        arrow(W/2,y-19,x+ww/2,y-3)
        card(head,body,x,y,ww,97)
    y+=97
    y+=27
    y=bullets(['<b>Socle envisagé :</b> application web commune, base Supabase et application Android issue du même produit.', '<b>Secrets côté serveur :</b> les navigateurs ne reçoivent pas les clés d’administration ni celles de l’analyse de documents.', '<b>Mises à jour :</b> suivi direct pour l’organisation et l’écran ; état agrégé léger pour les spectateurs.', '<b>Exploitation :</b> journal des erreurs, sauvegardes, export des résultats et absence de déploiement pendant une soirée.'],M,y,CW,10.2)
    caption('Les fournisseurs, modèles d’IA, tarifs et quotas sont des paramètres techniques à revalider au moment de l’implémentation. Ils ne conditionnent pas le fonctionnement présenté dans ce dossier.',y+8)

@page
def acceptance():
    y=title('06 / Recette','Ce qui devra fonctionner<br/>avant la première soirée','Ces critères sont des objectifs de validation. Le présent PDF ne constitue pas un rapport de tests du logiciel.')
    rows=[
        ('01','Accueil et inscription','Accès au vote visible ; premier vote en moins de 2 minutes dans des conditions réseau définies.'),
        ('02','Règles de vote','Modes libre et déblocage respectés côté serveur ; doublon remplacé ; fermeture opposable.'),
        ('03','Droits','Public incapable d’écrire une note jury ; juge limité à ses soirées ; écran en lecture seule.'),
        ('04','Calculs','Trois modes, deux méthodes et deux barèmes V1 ; tests des égalités et données manquantes.'),
        ('05','Imports','Quatre documents réels : PDF, photo, Word et Excel ; brouillon contrôlé puis appliqué.'),
        ('06','Direct et notifications','Déblocage visé en moins de 10 s ; notifications en moins de 15 s sur appareils compatibles.'),
        ('07','Charge et coupures','4 500 votants simulés, ou 1,5 fois l’affluence si supérieure ; aucun vote accepté perdu.'),
        ('08','Parcours complet','Créer, importer, noter, corriger, fermer, révéler et exporter sur téléphones réels.'),
        ('09','Vitrine et contact','Pages adaptées aux écrans, crédits et sources ; message effectivement reçu par l’organisateur.'),
        ('10','Android et qualité','Installation en test interne, notifications natives et réglage public ; audits performance et accessibilité.'),
    ]
    for num,head,body in rows:
        para(num,M,y,28,14,ORANGE,'DisplayI');para(head,M+39,y,CW-39,11,INK,'InterB')
        yy=para(body,M+39,y+19,CW-39,9.4,MUTED,leading=13)
        y=yy+15

@page
def roadmap():
    y=title('06 / Livraison','Un socle opérationnel,<br/>puis les variantes','Le cahier des charges précise une V1 ; le cadrage conserve les autres possibilités sans les confondre avec les fonctions déjà livrées.')
    y=table(['Étape','Périmètre à couvrir'],[
        ('1. Préparer','Accès, rôles, annuaire, soirées, programme, import, réglages et contenus publics.'),
        ('2. Faire voter','Inscription email, notes publiques /10, notes jury /10 ou /20, statuts et corrections.'),
        ('3. Piloter et publier','Cockpit, classements, visibilité, écran géant, CSV/PDF, avis et contact.'),
        ('4. Utiliser sur le terrain','Notifications, réseau dégradé, Android, charge et répétition d’une soirée complète.'),
        ('5. Étendre les règles','Critères, autres échelles, mesures, essais multiples, bonus/pénalités et votes alternatifs.'),
    ],y,[139,CW-139],10)
    y+=25
    y=card('Possibilités conservées, hors V1 détaillée','Équipes et gardians par édition ; historique par manade ; statistiques multi-soirées ; championnat de saison avec règles comparables. Les variantes de notation devront être ajoutées au modèle de données et testées.',M,y,CW)
    y+=19
    y=card('Hors V1','Billetterie et paiements, votes par SMS, application iOS publiée, commentaires publics, langues supplémentaires, newsletter et espaces publicitaires.',M,y,CW)
    caption('Le CDC v0.8 est un brouillon et mentionne un avancement technique. Cet avancement n’a pas été audité pour ce document : les captures proviennent de la maquette, pas d’une recette de production.',y+17)

@page
def decisions():
    y=title('06 / Préparer le pilote','Les choix d’une<br/>première édition réelle','Le produit peut être préparé dès maintenant. Les décisions ci-dessous rendent ses règles applicables à une soirée donnée.')
    groups=[
        ('Événement','Nom, date, horaires, arènes, affluence attendue, manades et ordre de passage. Prévoir report ou annulation.'),
        ('Règlement','Épreuves retenues, composition du jury, échelles, critères éventuels, essais, bonus/pénalités et coefficients.'),
        ('Classement','Moyenne ou points ; sort des ex æquo, absences et annulations ; composante manquante ; minimum de votes ; arrondis.'),
        ('Public','Mode libre ou déblocage ; prix du public ; classement séparé, combiné ou jury seul ; moment de la révélation.'),
        ('Organisation','Admins et juges habilités, procédure de correction, validation finale, répétition et solution de secours.'),
        ('Contenus et diffusion','Photos et logos autorisés, domaine, adresses email, palmarès validés, QR affichés, matériel de projection et compte Android.'),
    ]
    for i,(head,body) in enumerate(groups):
        rect(M,y,30,30,BLUE,r=7);para(str(i+1),M+10,y+5,17,13,'#e2c08a','InterB')
        para(head,M+44,y,CW-44,12.6,INK,'InterB');yy=para(body,M+44,y+24,CW-44,10,MUTED)
        y=yy+25
    caption('Une feuille de notation existante aidera à reproduire les usages réels. À défaut, l’organisateur peut définir et valider sa propre grille avant l’ouverture des votes.',y+2)

@page
def sources():
    y=title('07 / Sources et crédits','Un dossier traçable','Documents du projet consultés le 11 octobre 2026. Les illustrations d’interface proviennent de la maquette v1.')
    para('Références du projet',M,y,CW,15,INK,'DisplayB');y+=28
    y=bullets(['<b>CDC-MASTER.md</b> - cahier des charges v0.8, daté du 11/10/2026, statut brouillon.', '<b>recherche-olympiades.md</b> - recherche, modes de notation et décisions de cadrage.', '<b>charte-graphique.md</b> et <b>maquette/src.html</b> - identité et écrans de référence.'],M,y,CW,9.4)
    y+=6;para('Sources sportives de la recherche',M,y,CW,15,INK,'DisplayB');y+=28
    refs=[
        ('Programme de Cabannes : les quatre épreuves','https://provence-alpes-cotedazur.com/que-faire/sortir/toutes-les-sorties/olympiades-camarguaises-cabannes-fr-4283975/'),
        ('Beaucaire 2026 : annonce du Club Taurin Beaucairois','https://www.helloasso.com/associations/club-taurin-beaucairois/evenements/olympiades-beaucairoises-2026'),
        ('Alès 2026 : note sur 20 et résultat général, Objectif Sud','https://www.objectifsud.fr/actualites/ales-en-feria-les-gardians-rendent-hommage-a-leur-tradition-dans-une-soiree-de-concours-164007.php'),
        ('Beauvoisin 2025 : variantes des épreuves, Voir Plus','https://voir-plus.com/2025/08/23/au-rythme-de-la-fete-votive-beauvoisin/'),
        ('Eyguières 2008 : récompenses et points, Salluvii','https://www.salluvii.fr/Olympiades-Camarguaises-2008'),
    ]
    for label,url in refs:y=para(f'<link href="{url}" color="{ORANGE}">{escape(label)}</link>',M,y,CW,9.2,leading=13)+7
    y+=12;para('Photographies dans les captures et la couverture',M,y,CW,15,INK,'DisplayB');y+=29
    photos=[
        ('Gardian galopant vers sa manade','afroboof','2.0','Gardian_galopant_vers_sa_manade.jpg'),
        ('Arènes de Nîmes (couverture et captures)','Krzysztof Golik','4.0','Arenes_de_Nimes_(1).jpg'),
        ('Gardian et taureaux, Saint-Gilles','Christian Ferrer','4.0','Gardian_and_Camargue_cattle,_Saint-Gilles_11.jpg'),
        ('Chevaux de Camargue, Saint-Laurent-d’Aigouze','Benjamin Smith / Wikimedia Commons','4.0',"Saint-Laurent-d'Aigouze_-_Camargue_horses_-_01.jpg"),
    ]
    from urllib.parse import quote
    for label,author,lic,file in photos:
        url='https://commons.wikimedia.org/wiki/File:'+quote(file,safe="_(),-.")
        y=para(f'<link href="{url}" color="{ORANGE}">{escape(label)}</link><br/>{escape(author)} • <link href="https://creativecommons.org/licenses/by-sa/{lic}/" color="{ORANGE}">CC BY-SA {lic}</link> • via Wikimedia Commons.',M,y,CW,8.6,leading=12)+10
    caption('Retouches déjà présentes dans la maquette : niveaux de gris et duotone. Les adaptations photographiques conservent leur licence CC BY-SA respective. Les photos de contexte ne sont pas présentées comme des images des Olympiades elles-mêmes. Typographies : Inter et Playfair Display ; logo et signatures issus de la charte du projet.',y+4)

for i,fn in enumerate(PAGES,1):
    if i>1:rect(0,0,W,H,PAPER)
    c.bookmarkPage(f'p{i}')
    fn()
    c.addOutlineEntry(PAGE_TITLES.get(i,'Couverture'),f'p{i}',level=0,closed=False)
    if i>1:
        line(M,795,W-M,795)
        para('OLYMPIADE DES MANADES  /  DOSSIER FONCTIONNEL',M,806,CW-65,7.2,MUTED,'InterB',9)
        para(f'{i:02} / {len(PAGES):02}',W-M-50,804,50,9,MUTED,'InterB',11)
    c.showPage()
c.save()
(WORK/'layout-checks.json').write_text(json.dumps(CHECKS,ensure_ascii=False,indent=2))
print(f'{len(PAGES)} pages : {OUT}')
