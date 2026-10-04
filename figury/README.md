# Фигуры тела — исходники

Сделано в Blender 5.2 LTS с расширением MPFB 2.0.17 (ассеты MakeHuman). Сцены `figura-m.blend` и
`figura-zh.blend` хранятся у владельца (`C:\Users\Aleksandr\Pictures\models\`); для сборки сайта они не
нужны, здесь лежат только рендеры и скрипт.

Перерендер: открыть сцену в Blender, вкладка Scripting → Текст → Открыть → `render-figura.txt` → Alt+P,
или без окна: `blender -b figura-m.blend -P render-figura.txt`. Выход — папка `render/`: полные кадры
6000 px (`*-speredi.png`, `*-szadi.png`), превью 700 px (`*-preview.png`) и числа калибровки
(`*-kalibrovka.json`). Скрипт в сцену не вмешивается: только кадр, свет, камера, превью и калибровка.
При перерендере с другой позой или полями кадра коробки участков в `data/anatomy.json` нужно пересчитать
(см. `nalozhenie/anatomy-korobki-diff.md`).

Лицензии. Тело, скины, глаза, причёска `ponytail01` — MakeHuman system assets, CC0. Одежда — CC-BY 4.0:
`mindfront_male_swimming_trunks_02` (автор Mindfront, пак pants03), `punkduck_bikini02_bra` и
`punkduck_bikini02_slip` (автор punkduck, пак underwear02). Атрибуция — на странице «Как готовятся
и проверяются материалы».
