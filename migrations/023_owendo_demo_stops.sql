INSERT INTO school_stops(zone_id,name,sort_order)
SELECT z.id,x.name,x.ord FROM school_zones z
JOIN (VALUES ('Pont Nomba',1),('SNI',2),('Lycée Technique',3),('Alénakiri',4)) AS x(name,ord) ON true
WHERE z.name='Owendo'
ON CONFLICT(zone_id,name) DO NOTHING;