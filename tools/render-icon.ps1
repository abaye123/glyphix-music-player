# Draws the app icon and the UI glyphs into the assets folder.
# Usage: .\tools\render-icon.ps1 -OutDir (Resolve-Path src\assets)
param([string]$OutDir)
Add-Type -AssemblyName System.Drawing

# Everything is drawn on a 4x canvas and scaled down, so the edges stay smooth.
$Scale = 4

function Color($r, $g, $b) { return [System.Drawing.Color]::FromArgb($r, $g, $b) }

function New-Canvas($size) {
  $big = $size * $Scale
  $bmp = New-Object System.Drawing.Bitmap $big, $big
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.ScaleTransform($Scale, $Scale)
  return @($bmp, $g)
}

function Save-Canvas($bmp, $size, $name) {
  $small = New-Object System.Drawing.Bitmap $size, $size
  $s = [System.Drawing.Graphics]::FromImage($small)
  $s.InterpolationMode = 'HighQualityBicubic'
  $s.SmoothingMode = 'AntiAlias'
  $s.Clear([System.Drawing.Color]::Transparent)
  $s.DrawImage($bmp, 0, 0, $size, $size)
  $small.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
}

function Pt($x, $y) { return New-Object System.Drawing.PointF($x, $y) }

function Brush($c) { return New-Object System.Drawing.SolidBrush $c }

function RoundPen($c, $w) {
  $p = New-Object System.Drawing.Pen $c, $w
  $p.StartCap = 'Round'; $p.EndCap = 'Round'; $p.LineJoin = 'Round'
  return $p
}

# A single eighth note in a 100x100 box.
function Draw-Note($g, $c) {
  $b = Brush $c
  $g.FillEllipse($b, 18, 62, 36, 27)
  $g.FillRectangle($b, 47, 14, 8, 64)
  $flag = New-Object System.Drawing.Drawing2D.GraphicsPath
  $flag.AddBezier((Pt 51 14), (Pt 60 30), (Pt 84 34), (Pt 76 60))
  $flag.AddBezier((Pt 76 60), (Pt 78 44), (Pt 64 38), (Pt 51 36))
  $flag.CloseFigure()
  $g.FillPath($b, $flag)
}

$White = Color 255 255 255
$Accent = Color 255 160 64
$Dim = Color 120 120 140

# App icon: a white note on an orange-to-purple disc.
$bmp, $g = New-Canvas 192
$rect = New-Object System.Drawing.Rectangle(0, 0, 192, 192)
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, (Color 255 140 50), (Color 120 40 160), 60.0)
$g.FillEllipse($bg, 4, 4, 184, 184)
$g.TranslateTransform(36, 34)
$g.ScaleTransform(1.25, 1.25)
Draw-Note $g $White
Save-Canvas $bmp 192 'icon.png'

# Cover placeholder note (dim).
$bmp, $g = New-Canvas 96
$g.ScaleTransform(0.96, 0.96)
Draw-Note $g (Color 150 150 170)
Save-Canvas $bmp 96 'note.png'

# Small note for list rows.
$bmp, $g = New-Canvas 48
$g.ScaleTransform(0.48, 0.48)
Draw-Note $g $Accent
Save-Canvas $bmp 48 'note-small.png'

# Transport glyphs, 64x64.
function Save-Play($name, $c) {
  $bmp, $g = New-Canvas 64
  $g.FillPolygon((Brush $c), [System.Drawing.PointF[]]@((Pt 20 12), (Pt 54 32), (Pt 20 52)))
  Save-Canvas $bmp 64 $name
}
Save-Play 'play.png' (Color 20 20 30)

$bmp, $g = New-Canvas 64
$b = Brush (Color 20 20 30)
$g.FillRectangle($b, 16, 12, 11, 40)
$g.FillRectangle($b, 37, 12, 11, 40)
Save-Canvas $bmp 64 'pause.png'

$bmp, $g = New-Canvas 64
$b = Brush $White
$g.FillRectangle($b, 12, 14, 7, 36)
$g.FillPolygon($b, [System.Drawing.PointF[]]@((Pt 52 14), (Pt 20 32), (Pt 52 50)))
Save-Canvas $bmp 64 'prev.png'

$bmp, $g = New-Canvas 64
$b = Brush $White
$g.FillRectangle($b, 45, 14, 7, 36)
$g.FillPolygon($b, [System.Drawing.PointF[]]@((Pt 12 14), (Pt 44 32), (Pt 12 50)))
Save-Canvas $bmp 64 'next.png'

# Heart: on (filled red) and off (outline).
function Heart-Path {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddBezier((Pt 32 54), (Pt 10 40), (Pt 4 26), (Pt 12 16))
  $p.AddBezier((Pt 12 16), (Pt 20 6), (Pt 30 10), (Pt 32 20))
  $p.AddBezier((Pt 32 20), (Pt 34 10), (Pt 44 6), (Pt 52 16))
  $p.AddBezier((Pt 52 16), (Pt 60 26), (Pt 54 40), (Pt 32 54))
  $p.CloseFigure()
  return $p
}
$bmp, $g = New-Canvas 64
$g.FillPath((Brush (Color 255 70 90)), (Heart-Path))
Save-Canvas $bmp 64 'heart-on.png'
$bmp, $g = New-Canvas 64
$g.DrawPath((RoundPen $White 5), (Heart-Path))
Save-Canvas $bmp 64 'heart-off.png'

# Shuffle: two crossing arrows.
function Save-Shuffle($name, $c) {
  $bmp, $g = New-Canvas 64
  $pen = RoundPen $c 5
  $g.DrawBezier($pen, (Pt 8 18), (Pt 28 18), (Pt 30 46), (Pt 50 46))
  $g.DrawBezier($pen, (Pt 8 46), (Pt 28 46), (Pt 30 18), (Pt 50 18))
  $b = Brush $c
  $g.FillPolygon($b, [System.Drawing.PointF[]]@((Pt 46 9), (Pt 58 18), (Pt 46 27)))
  $g.FillPolygon($b, [System.Drawing.PointF[]]@((Pt 46 37), (Pt 58 46), (Pt 46 55)))
  Save-Canvas $bmp 64 $name
}
Save-Shuffle 'shuffle-on.png' $Accent
Save-Shuffle 'shuffle-off.png' $Dim

# Repeat: a rounded loop with an arrow; "one" adds a small 1.
function Save-Repeat($name, $c, $one) {
  $bmp, $g = New-Canvas 64
  $pen = RoundPen $c 5
  $g.DrawArc($pen, 8, 16, 48, 32, 200, 300)
  $g.FillPolygon((Brush $c), [System.Drawing.PointF[]]@((Pt 6 18), (Pt 20 12), (Pt 16 28)))
  if ($one) {
    $font = New-Object System.Drawing.Font('Arial', 18, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $fmt = New-Object System.Drawing.StringFormat
    $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
    $g.DrawString('1', $font, (Brush $c), (New-Object System.Drawing.RectangleF(20, 20, 24, 24)), $fmt)
  }
  Save-Canvas $bmp 64 $name
}
Save-Repeat 'repeat-off.png' $Dim $false
Save-Repeat 'repeat-all.png' $Accent $false
Save-Repeat 'repeat-one.png' $Accent $true

# Folder for list rows.
$bmp, $g = New-Canvas 48
$b = Brush (Color 255 196 80)
$g.FillRectangle($b, 4, 10, 18, 8)
$g.FillRectangle($b, 4, 14, 40, 26)
Save-Canvas $bmp 48 'folder.png'
