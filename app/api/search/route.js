
export const runtime = 'nodejs';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title');
    const issue = searchParams.get('issue');

    if (!title) {
        return Response.json({ ok: false, error: 'Missing title parameter' }, { status: 400 });
    }

    // Mock Search Logic
    const candidates = [
        {
            editionId: `manual-${title}-${issue || '1'}-A`,
            displayName: `${title} #${issue || '1'}`,
            coverUrl: "https://comicvine.gamespot.com/a/uploads/scale_small/11/117763/3143431-cm01.jpg",
            variantHint: "Cover A",
            year: "????",
            publisher: "Unknown"
        },
        {
            editionId: `manual-${title}-${issue || '1'}-B`,
            displayName: `${title} #${issue || '1'} (Variant)`,
            coverUrl: "https://comicvine.gamespot.com/a/uploads/scale_small/11/117763/3143432-cm02.jpg",
            variantHint: "Variant B",
            year: "????",
            publisher: "Unknown"
        }
    ];

    return Response.json({
        ok: true,
        candidates,
        variantRisk: "MEDIUM"
    });
}
