document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById("generate-button");
    const qrCodeContainer = document.getElementById('qr-code-container');
    button.addEventListener('click', async () => {
        const vatin = document.getElementById('vatin').value;
        const first_name = document.getElementById('first_name').value;
        const last_name = document.getElementById('last_name').value;

        try {
            const response = await fetch('/generate-qrcode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ vatin, first_name, last_name }),
            });

            if (response.ok) {
                const data = await response.json();

                const img = document.createElement('img');
                img.src = data.qrCodeImageUrl;
                img.alt = "Generiran QR kod";
                qrCodeContainer.innerHTML = '';
                qrCodeContainer.appendChild(img);
            } else {
                const errorData = await response.json();
                alert(`${errorData.error}`);
            }

        } catch (err) {
            console.error('Error prilikom predaje informacija: ', err);
            alert('Greška prilikom predaje informacija');
        }

    });
});