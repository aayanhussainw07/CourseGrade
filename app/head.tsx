export default function Head() {
  const adSenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  return (
    <>
      {adSenseClient ? (
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adSenseClient}`}
          crossOrigin="anonymous"
        />
      ) : null}
      <title>CourseGrade</title>
      <meta
        name="description"
        content="A website to handle all your course grading needs."
      />
    </>
  );
}
