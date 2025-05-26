## Sobre este proyecto

Este proyecto no tiene ninguna vinculación oficial con WhatsApp. Fue desarrollado de forma independiente para interacciones automatizadas mediante la plataforma.

No nos hacemos responsables por el uso indebido de este bot. Es responsabilidad exclusiva del usuario asegurarse de que su uso cumpla con los términos de servicio de WhatsApp y la legislación vigente.

## Instalación en Termux

1 - Abre Termux y ejecuta los siguientes comandos.<br/>
_¿No tienes Termux? [Haz clic aquí y descarga la última versión](https://www.mediafire.com/file/082otphidepx7aq/Termux_0.119.1_aldebaran_dev.apk)._

```sh
pkg upgrade -y && pkg update -y && pkg install git -y && pkg install nodejs-lts -y && pkg install ffmpeg -y

2 - Habilita el acceso a la carpeta de almacenamiento en Termux.

termux-setup-storage

3 - Entra a la carpeta sdcard.

cd /sdcard

4 - Clona el repositorio.

git clone https://github.com/guiireal/takeshi-bot.git

5 - Entra en la carpeta que se clonó.

cd takeshi-bot

6 - Habilita permisos de lectura y escritura (haz este paso solo una vez).

chmod -R 755 ./*

7 - Ejecuta el bot.

npm start

8 - Ingresa el número de teléfono y presiona enter.

9 - Ingresa el código que aparece en Termux en tu WhatsApp. Mira aquí si no encuentras esta opción.

10 - Espera 10 segundos y luego presiona CTRL + C para detener el bot.

11 - Configura el archivo config.js que está dentro de la carpeta src.
