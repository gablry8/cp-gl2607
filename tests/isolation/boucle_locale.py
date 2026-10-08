# Active l'interface de boucle locale (lo) dans un espace réseau neuf (unshare -n), sans la commande « ip ».
# Utilisé par tests/run-all.sh. Affiche les interfaces présentes : seule « lo » doit exister.
import fcntl, os, socket, struct
SIOCGIFFLAGS, SIOCSIFFLAGS, IFF_UP = 0x8913, 0x8914, 0x1
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
drapeaux = struct.unpack('16sh', fcntl.ioctl(s, SIOCGIFFLAGS, struct.pack('16sh', b'lo', 0)))[1]
fcntl.ioctl(s, SIOCSIFFLAGS, struct.pack('16sh', b'lo', drapeaux | IFF_UP))
# /proc/self/net/dev reflète l'espace réseau du processus (/sys/class/net peut montrer celui de la machine)
noms = sorted(l.split(':')[0].strip() for l in open('/proc/self/net/dev').read().splitlines()[2:] if ':' in l)
print('interfaces :', ' '.join(noms))
