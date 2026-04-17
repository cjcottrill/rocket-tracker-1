import qrcode

# Generate QR code
url = 'https://christherocketguy.com'
qr = qrcode.make(url)
qr.save('qr_code.png')
